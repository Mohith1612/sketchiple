import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import type { WebSocket } from 'uWebSockets.js'
import type { UserData } from '../ws/handler.js'
import { MSG_SYNC, MSG_AWARENESS } from '@canvas-draw/shared'
import * as encoding from 'lib0/encoding'
import { logger } from '../utils/logger.js'

export class Room {
  readonly roomId: string
  readonly doc: Y.Doc
  readonly awareness: awarenessProtocol.Awareness
  private clients: Set<WebSocket<UserData>>

  constructor(roomId: string) {
    this.roomId = roomId
    this.doc = new Y.Doc()
    this.awareness = new awarenessProtocol.Awareness(this.doc)
    this.clients = new Set()

    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changedClients = [...added, ...updated, ...removed]
      const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      this.broadcastAwareness(update)
    })
  }

  addClient(ws: WebSocket<UserData>): void {
    this.clients.add(ws)
  }

  removeClient(ws: WebSocket<UserData>): void {
    this.clients.delete(ws)
  }

  get isEmpty(): boolean {
    return this.clients.size === 0
  }

  get clientCount(): number {
    return this.clients.size
  }

  applyUpdate(update: Uint8Array, origin: WebSocket<UserData>): void {
    Y.applyUpdate(this.doc, update, origin)
    this.broadcast(encodeSyncUpdate(update), origin)
  }

  broadcast(message: Uint8Array, exclude?: WebSocket<UserData>): void {
    for (const client of this.clients) {
      if (client === exclude) continue
      client.send(message, true)
    }
  }

  sendToClient(ws: WebSocket<UserData>, message: Uint8Array): void {
    ws.send(message, true)
  }

  broadcastAwareness(awarenessUpdate: Uint8Array): void {
    const msg = encodeAwarenessMessage(awarenessUpdate)
    this.broadcast(msg)
  }

  destroy(): void {
    this.awareness.destroy()
    this.doc.destroy()
    this.clients.clear()
    logger.info('room destroyed', { roomId: this.roomId })
  }
}

function encodeSyncUpdate(update: Uint8Array): Uint8Array {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, MSG_SYNC)
  encoding.writeVarUint(enc, 2)
  encoding.writeVarUint8Array(enc, update)
  return encoding.toUint8Array(enc) as Uint8Array
}

function encodeAwarenessMessage(update: Uint8Array): Uint8Array {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, MSG_AWARENESS)
  encoding.writeVarUint8Array(enc, update)
  return encoding.toUint8Array(enc) as Uint8Array
}
