import { describe, expect, it, vi } from 'vitest'
import { Room } from '../../src/rooms/Room.ts'
import type { UserData } from '../../src/ws/handler.js'

type FakeSocket = {
  send: ReturnType<typeof vi.fn>
  getBufferedAmount: ReturnType<typeof vi.fn>
  getUserData: () => UserData
}

function makeSocket(
  userId: string,
  sendStatuses: Array<0 | 1 | 2>,
  bufferedAmount: number = 0,
): FakeSocket {
  return {
    send: vi.fn(() => sendStatuses.shift() ?? 1),
    getBufferedAmount: vi.fn(() => bufferedAmount),
    getUserData: () => ({
      roomId: 'room-1',
      userId,
      rateLimit: { tokens: 1, lastRefillAt: 0 },
    }),
  }
}

describe('Room backpressure handling', () => {
  it('queues on backpressure and flushes on drain', () => {
    const room = new Room('room-1', {
      maxBufferedBytes: 1024,
      maxQueuedMessages: 4,
      drainBatchSize: 4,
    })

    const ws = makeSocket('u1', [0, 1, 1])
    room.addClient(ws as never)

    room.sendToClient(ws as never, new Uint8Array([1]))
    expect(ws.send).toHaveBeenCalledTimes(1)

    room.handleDrain(ws as never)
    expect(ws.send).toHaveBeenCalledTimes(2)

    room.handleDrain(ws as never)
    expect(ws.send).toHaveBeenCalledTimes(2)

    room.destroy()
  })

  it('drops when queue is full', () => {
    const room = new Room('room-1', {
      maxBufferedBytes: 1,
      maxQueuedMessages: 1,
      drainBatchSize: 1,
    })

    const ws = makeSocket('u1', [0], 9999)
    room.addClient(ws as never)

    room.sendToClient(ws as never, new Uint8Array([1]))
    room.sendToClient(ws as never, new Uint8Array([2]))

    // No send attempt since buffered amount was above threshold.
    expect(ws.send).toHaveBeenCalledTimes(0)

    room.destroy()
  })
})
