import { describe, expect, it } from 'vitest'
import { RoomManager } from '../../src/rooms/RoomManager.ts'

describe('RoomManager', () => {
  it('creates, returns, and deletes rooms', () => {
    const manager = new RoomManager()

    expect(manager.size).toBe(0)

    const roomA = manager.getOrCreate('room-a')
    expect(manager.size).toBe(1)
    expect(manager.getRoom('room-a')).toBe(roomA)

    const roomAAgain = manager.getOrCreate('room-a')
    expect(roomAAgain).toBe(roomA)
    expect(manager.size).toBe(1)

    manager.deleteRoom('room-a')
    expect(manager.getRoom('room-a')).toBeUndefined()
    expect(manager.size).toBe(0)
  })
})
