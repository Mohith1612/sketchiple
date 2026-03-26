import { Room } from './Room.js'
import { logger } from '../utils/logger.js'

export class RoomManager {
  private rooms = new Map<string, Room>()

  getOrCreate(roomId: string): Room {
    let room = this.rooms.get(roomId)
    if (!room) {
      room = new Room(roomId)
      this.rooms.set(roomId, room)
      logger.info('room created', { roomId })
    }
    return room
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    room.destroy()
    this.rooms.delete(roomId)
    logger.info('room deleted', { roomId })
  }

  get size(): number {
    return this.rooms.size
  }
}
