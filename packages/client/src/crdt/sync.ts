/**
 * Manual WebSocket provider for Yjs sync with the uWS server.
 *
 * Does NOT use y-websocket — that library is coupled to the ws/Node EventEmitter API.
 * Instead: plain browser WebSocket + y-protocols + lib0.
 *
 * CRITICAL: ws.binaryType = 'arraybuffer' must be set before the first message.
 * Without it the browser defaults to 'blob' and binary data is silently garbled.
 */
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import { MSG_SYNC, MSG_AWARENESS } from '@canvas-draw/shared'
import type { Shape } from '@canvas-draw/shared'
import { ydoc, getShapesMap } from './doc.js'
import { useShapeStore } from '../store/shapeStore.js'

export type WsState = 'DISCONNECTED' | 'CONNECTING' | 'HANDSHAKING' | 'SYNCED'

type StateListener = (state: WsState) => void

class YjsWebSocketProvider {
  private ws: WebSocket | null = null
  private roomId: string = ''
  private reconnectAttempt = 0
  private readonly baseDelay = 1000
  private readonly maxDelay = 30_000
  private readonly jitterRatio = 0.3
  private readonly maxReconnectAttempts: number
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false
  private _state: WsState = 'DISCONNECTED'
  private stateListeners: Set<StateListener> = new Set()

  awareness: awarenessProtocol.Awareness

  constructor() {
    const rawMaxRetries: unknown = import.meta.env.VITE_WS_MAX_RETRIES
    const parsedMaxRetries = typeof rawMaxRetries === 'string' ? Number(rawMaxRetries) : NaN
    this.maxReconnectAttempts = Number.isFinite(parsedMaxRetries) && parsedMaxRetries > 0
      ? Math.floor(parsedMaxRetries)
      : 20

    this.awareness = new awarenessProtocol.Awareness(ydoc)

    // When local awareness changes, send to server
    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
      const changedClients = [...added, ...updated, ...removed]
      const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      this.ws.send(encodeAwareness(update))
    })

    // When doc gets a local update, send to server
    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === this) return
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
      this.ws.send(encodeSyncUpdate(update))
    })
  }

  get state(): WsState {
    return this._state
  }

  private setState(s: WsState): void {
    this._state = s
    this.stateListeners.forEach((fn) => fn(s))
  }

  onStateChange(fn: StateListener): () => void {
    this.stateListeners.add(fn)
    return () => this.stateListeners.delete(fn)
  }

  connect(roomId: string): void {
    if (
      this.roomId === roomId &&
      this.ws !== null &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }
    this.destroyed = false
    this.roomId = roomId
    this.reconnectAttempt = 0
    this._connect()
  }

  private _connect(): void {
    if (this.destroyed) return

    if (this.ws) {
      const old = this.ws
      this.ws = null
      old.onopen = null
      old.onmessage = null
      old.onerror = null
      old.onclose = null
      try { old.close(1000, 'reconnecting') } catch { /* ignore */ }
    }

    this.setState('CONNECTING')

    const wsUrl = buildWsUrl(this.roomId)
    const ws = new WebSocket(wsUrl)
    this.ws = ws

    ws.onopen = () => {
      this.reconnectAttempt = 0
      this.setState('HANDSHAKING')
      console.debug('[ws] connected, awaiting syncStep1 from server', { roomId: this.roomId })
      // Send our syncStep1 so the server knows what state vector we have
      this.ws?.send(encodeSyncStep1())
    }

    ws.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      this.handleIncoming(new Uint8Array(event.data))
    }

    ws.onclose = () => {
      this.ws = null
      if (this.destroyed) return
      this.setState('DISCONNECTED')
      this.scheduleReconnect()
    }

    ws.onerror = (err) => {
      console.warn('[ws] error:', err)
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      console.warn('[ws] reconnect attempts exhausted', {
        roomId: this.roomId,
        maxAttempts: this.maxReconnectAttempts,
      })
      return
    }

    this.reconnectAttempt += 1
    const delay = computeJitteredBackoffMs(
      this.reconnectAttempt,
      this.baseDelay,
      this.maxDelay,
      this.jitterRatio,
    )

    console.debug('[ws] disconnected, reconnecting in', delay, 'ms', {
      roomId: this.roomId,
      attempt: this.reconnectAttempt,
      maxAttempts: this.maxReconnectAttempts,
    })

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this._connect()
    }, delay)
  }

  private handleIncoming(data: Uint8Array): void {
    const dec = decoding.createDecoder(data)
    const msgType = decoding.readVarUint(dec)

    if (msgType === MSG_SYNC) {
      const replyEnc = encoding.createEncoder()
      encoding.writeVarUint(replyEnc, MSG_SYNC)

      const syncMsgTypeRaw: unknown = syncProtocol.readSyncMessage(dec, replyEnc, ydoc, this)
      const syncMsgType = typeof syncMsgTypeRaw === 'number' ? syncMsgTypeRaw : -1

      if (encoding.length(replyEnc) > 1) {
        this.ws?.send(toUint8ArraySafe(encoding.toUint8Array(replyEnc)))
      }

      if (syncMsgType === 0) {
        const ourStep1 = encodeSyncStep1()
        this.ws?.send(ourStep1)
      }

      if (syncMsgType === 1) {
        this.setState('SYNCED')
        console.debug('[ws] sync complete', { roomId: this.roomId, shapes: getShapesMap().size })
        const shapes: Record<string, Shape> = {}
        for (const [id, shape] of getShapesMap().entries()) {
          shapes[id] = shape
        }
        useShapeStore.getState()._setShapes(shapes)
      }
    } else if (msgType === MSG_AWARENESS) {
      const update = toUint8ArraySafe(decoding.readVarUint8Array(dec))
      awarenessProtocol.applyAwarenessUpdate(this.awareness, update, this)
    }
  }

  disconnect(): void {
    this.destroyed = true
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempt = 0
    this.ws?.close()
    this.awareness.destroy()
  }
}

export function computeJitteredBackoffMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterRatio: number,
  random: number = Math.random(),
): number {
  const exp = Math.max(0, attempt - 1)
  const base = Math.min(maxDelayMs, baseDelayMs * 2 ** exp)
  const jitterMultiplier = 1 - jitterRatio + random * 2 * jitterRatio
  return Math.max(0, Math.floor(base * jitterMultiplier))
}

function encodeSyncStep1(): Uint8Array {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, MSG_SYNC)
  syncProtocol.writeSyncStep1(enc, ydoc)
  return toUint8ArraySafe(encoding.toUint8Array(enc))
}

function encodeSyncUpdate(update: Uint8Array): Uint8Array {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, MSG_SYNC)
  encoding.writeVarUint(enc, 2) // messageYjsUpdate
  encoding.writeVarUint8Array(enc, update)
  return toUint8ArraySafe(encoding.toUint8Array(enc))
}

function encodeAwareness(update: Uint8Array): Uint8Array {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, MSG_AWARENESS)
  encoding.writeVarUint8Array(enc, update)
  return toUint8ArraySafe(encoding.toUint8Array(enc))
}

function toUint8ArraySafe(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  throw new Error('Expected Uint8Array payload')
}

function buildWsUrl(roomId: string): string {
  const rawBase: unknown = import.meta.env.VITE_WS_URL
  const base = typeof rawBase === 'string' ? rawBase : ''
  if (base) return `${base}/ws/${roomId}`
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/${roomId}`
}

export const wsProvider = new YjsWebSocketProvider()
