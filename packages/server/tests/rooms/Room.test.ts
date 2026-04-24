import { describe, expect, it } from 'vitest'
import { Room } from '../../src/rooms/Room.ts'

describe('Room', () => {
  it('initializes empty and tracks client count', () => {
    const room = new Room('room-1')

    expect(room.isEmpty).toBe(true)
    expect(room.clientCount).toBe(0)

    room.destroy()
  })
})
