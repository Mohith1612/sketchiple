import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import type { WebSocket } from 'uWebSockets.js'
import type { UserData } from '../ws/handler.js'
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

  broadcast(message: Uint8Array, exclude?: WebSocket<UserData>): void {
    for (const client of this.clients) {
      if (client === exclude) continue
      client.send(message, true)
    }
  }

  sendToClient(ws: WebSocket<UserData>, message: Uint8Array): void {
    ws.send(message, true)
  }

  destroy(): void {
    this.awareness.destroy()
    this.doc.destroy()
    this.clients.clear()
    logger.info('room destroyed', { roomId: this.roomId })
  }
}
