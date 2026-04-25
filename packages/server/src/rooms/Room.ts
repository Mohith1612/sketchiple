import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import type { WebSocket } from 'uWebSockets.js'
import type { UserData } from '../ws/handler.js'
import { incCounter } from '../metrics/metrics.js'
import { logger } from '../utils/logger.js'

interface BackpressureState {
  queue: Uint8Array[]
  droppedCount: number
}

export interface RoomBackpressureOptions {
  maxBufferedBytes: number
  maxQueuedMessages: number
  drainBatchSize: number
}

const DEFAULT_BACKPRESSURE_OPTIONS: RoomBackpressureOptions = {
  maxBufferedBytes: Number(process.env.WS_MAX_BUFFERED_BYTES ?? 256 * 1024),
  maxQueuedMessages: Number(process.env.WS_MAX_QUEUED_MESSAGES ?? 64),
  drainBatchSize: Number(process.env.WS_DRAIN_BATCH_SIZE ?? 64),
}

export class Room {
  readonly roomId: string
  readonly doc: Y.Doc
  readonly awareness: awarenessProtocol.Awareness
  private clients: Set<WebSocket<UserData>>
  private backpressureByClient: Map<WebSocket<UserData>, BackpressureState>
  private readonly backpressureOptions: RoomBackpressureOptions

  constructor(roomId: string, options?: Partial<RoomBackpressureOptions>) {
    this.roomId = roomId
    this.doc = new Y.Doc()
    this.awareness = new awarenessProtocol.Awareness(this.doc)
    this.clients = new Set()
    this.backpressureByClient = new Map()
    this.backpressureOptions = { ...DEFAULT_BACKPRESSURE_OPTIONS, ...options }

    // When awareness state changes locally (server-side), broadcast to all clients
    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changedClients = [...added, ...updated, ...removed]
      const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      this.broadcastAwareness(update)
    })
  }

  addClient(ws: WebSocket<UserData>): void {
    this.clients.add(ws)
    this.backpressureByClient.set(ws, { queue: [], droppedCount: 0 })
  }

  removeClient(ws: WebSocket<UserData>): void {
    this.clients.delete(ws)
    this.backpressureByClient.delete(ws)
  }

  get isEmpty(): boolean {
    return this.clients.size === 0
  }

  get clientCount(): number {
    return this.clients.size
  }

  /**
   * Apply a Yjs update to the document and broadcast to all other clients.
   * @param update - Copied Uint8Array (never pass raw uWS buffer)
   * @param origin - The sending WebSocket (excluded from broadcast)
   */
  applyUpdate(update: Uint8Array, origin: WebSocket<UserData>): void {
    Y.applyUpdate(this.doc, update, origin)
    // Broadcast the minimal diff rather than the raw received update,
    // so clients that are behind get the full state.
    // For V1 simplicity, re-broadcast the received update (already a valid diff).
    this.broadcast(encodeSyncUpdate(update), origin)
  }

  broadcast(message: Uint8Array, exclude?: WebSocket<UserData>): void {
    for (const client of this.clients) {
      if (client === exclude) continue
      this.sendWithBackpressure(client, message)
    }
  }

  sendToClient(ws: WebSocket<UserData>, message: Uint8Array): void {
    this.sendWithBackpressure(ws, message)
  }

  handleDrain(ws: WebSocket<UserData>): void {
    const state = this.backpressureByClient.get(ws)
    if (!state || state.queue.length === 0) return

    let sent = 0
    while (state.queue.length > 0 && sent < this.backpressureOptions.drainBatchSize) {
      if (ws.getBufferedAmount() > this.backpressureOptions.maxBufferedBytes) return

      const next = state.queue[0]
      if (!next) return
      const sendStatus = ws.send(next, true)
      if (sendStatus === 1) {
        state.queue.shift()
        sent += 1
        continue
      }

      // 0 = accepted with growing backpressure, 2 = dropped by uWS backpressure limit
      if (sendStatus === 0 || sendStatus === 2) return
    }
  }

  broadcastAwareness(awarenessUpdate: Uint8Array): void {
    const msg = encodeAwarenessMessage(awarenessUpdate)
    this.broadcast(msg)
  }

  destroy(): void {
    this.awareness.destroy()
    this.doc.destroy()
    this.clients.clear()
    this.backpressureByClient.clear()
  }

  private sendWithBackpressure(ws: WebSocket<UserData>, message: Uint8Array): void {
    const state = this.backpressureByClient.get(ws)
    if (!state) return

    if (ws.getBufferedAmount() > this.backpressureOptions.maxBufferedBytes) {
      this.enqueueOrDrop(ws, state, message)
      return
    }

    const sendStatus = ws.send(message, true)
    if (sendStatus === 1) return

    // 0 = accepted with backpressure, 2 = dropped by backpressure limit.
    // In both cases, keep a bounded retry queue and let drain flush later.
    this.enqueueOrDrop(ws, state, message)
  }

  private enqueueOrDrop(
    ws: WebSocket<UserData>,
    state: BackpressureState,
    message: Uint8Array,
  ): void {
    if (state.queue.length >= this.backpressureOptions.maxQueuedMessages) {
      state.droppedCount += 1
      incCounter('ws_backpressure_drops_total')
      if (state.droppedCount % 10 === 0) {
        const userData = ws.getUserData()
        logger.warn('ws queue drop due to backpressure', {
          roomId: this.roomId,
          userId: userData.userId,
          droppedCount: state.droppedCount,
          queueLength: state.queue.length,
        })
      }
      return
    }

    state.queue.push(message)
  }
}

// Inline message encoders (avoid circular dependency with protocol.ts)
import { MSG_SYNC, MSG_AWARENESS } from '@canvas-draw/shared'
import * as encoding from 'lib0/encoding'

function encodeSyncUpdate(update: Uint8Array): Uint8Array {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, MSG_SYNC)
  encoding.writeVarUint(enc, 2) // messageYjsUpdate = 2
  encoding.writeVarUint8Array(enc, update)
  return toUint8ArraySafe(encoding.toUint8Array(enc))
}

function encodeAwarenessMessage(update: Uint8Array): Uint8Array {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, MSG_AWARENESS)
  encoding.writeVarUint8Array(enc, update)
  return toUint8ArraySafe(encoding.toUint8Array(enc))
}

function toUint8ArraySafe(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  throw new Error('Expected Uint8Array payload')
}
