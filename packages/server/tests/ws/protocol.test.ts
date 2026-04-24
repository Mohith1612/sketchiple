import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import { MSG_AWARENESS, MSG_SYNC } from '@canvas-draw/shared'
import { encodeAwareness, encodeSyncStep1, handleMessage } from '../../src/ws/protocol.ts'
import { isAllowedWsOrigin, isValidRoomId } from '../../src/ws/handler.ts'

describe('ws protocol', () => {
  it('encodes sync step1 with MSG_SYNC outer frame', () => {
    const msg = encodeSyncStep1(new Y.Doc())
    const dec = decoding.createDecoder(msg)
    const msgType = decoding.readVarUint(dec)

    expect(msgType).toBe(MSG_SYNC)
  })

  it('broadcasts awareness updates to room clients', () => {
    const doc = new Y.Doc()
    const awareness = new awarenessProtocol.Awareness(doc)
    awareness.setLocalState({ userId: 'u1' })

    const update = awarenessProtocol.encodeAwarenessUpdate(awareness, [doc.clientID])

    const incoming = encoding.createEncoder()
    encoding.writeVarUint(incoming, MSG_AWARENESS)
    encoding.writeVarUint8Array(incoming, update)

    const room = {
      doc,
      awareness,
      broadcast: vi.fn(),
    }

    const ws = { send: vi.fn() }

    handleMessage(encoding.toUint8Array(incoming), room as never, ws as never)

    expect(room.broadcast).toHaveBeenCalledTimes(1)

    const broadcastArg = room.broadcast.mock.calls[0]?.[0] as Uint8Array
    const dec = decoding.createDecoder(broadcastArg)
    expect(decoding.readVarUint(dec)).toBe(MSG_AWARENESS)
  })

  it('encodeAwareness wraps payload with outer awareness message type', () => {
    const payload = new Uint8Array([1, 2, 3])
    const msg = encodeAwareness(payload)

    const dec = decoding.createDecoder(msg)
    expect(decoding.readVarUint(dec)).toBe(MSG_AWARENESS)
    expect(decoding.readVarUint8Array(dec)).toEqual(payload)
  })

  it('validates canonical uuidv7 room ids', () => {
    expect(isValidRoomId('018f8f3a-1d7c-7a3b-9f5e-1b2d3c4d5e6f')).toBe(true)
    expect(isValidRoomId('room-1')).toBe(false)
  })

  it('allows loopback origins by default and rejects others', () => {
    delete process.env.WS_ALLOWED_ORIGINS

    expect(isAllowedWsOrigin('http://localhost:5173')).toBe(true)
    expect(isAllowedWsOrigin('http://127.0.0.1:4173')).toBe(true)
    expect(isAllowedWsOrigin('https://example.com')).toBe(false)
  })

  it('rejects unknown outer message types', () => {
    const room = {
      doc: new Y.Doc(),
      awareness: new awarenessProtocol.Awareness(new Y.Doc()),
      broadcast: vi.fn(),
    }
    const ws = { send: vi.fn() }

    const incoming = encoding.createEncoder()
    encoding.writeVarUint(incoming, 999)

    expect(() => handleMessage(encoding.toUint8Array(incoming), room as never, ws as never)).toThrow(
      'Unknown outer message type',
    )
  })

  it('rejects malformed awareness payloads', () => {
    const room = {
      doc: new Y.Doc(),
      awareness: new awarenessProtocol.Awareness(new Y.Doc()),
      broadcast: vi.fn(),
    }
    const ws = { send: vi.fn() }

    const incoming = encoding.createEncoder()
    encoding.writeVarUint(incoming, MSG_AWARENESS)
    // Missing varUint8Array payload intentionally

    expect(() => handleMessage(encoding.toUint8Array(incoming), room as never, ws as never)).toThrow(
      'Failed to decode awareness payload',
    )
  })

  it('rejects awareness payloads with trailing bytes', () => {
    const room = {
      doc: new Y.Doc(),
      awareness: new awarenessProtocol.Awareness(new Y.Doc()),
      broadcast: vi.fn(),
    }
    const ws = { send: vi.fn() }

    const incoming = encoding.createEncoder()
    encoding.writeVarUint(incoming, MSG_AWARENESS)
    encoding.writeVarUint8Array(incoming, new Uint8Array([1]))
    encoding.writeVarUint(incoming, 7) // trailing data

    expect(() => handleMessage(encoding.toUint8Array(incoming), room as never, ws as never)).toThrow(
      'Unexpected trailing bytes in AWARENESS payload',
    )
  })

  it('rejects malformed sync update payloads', () => {
    const room = {
      doc: new Y.Doc(),
      awareness: new awarenessProtocol.Awareness(new Y.Doc()),
      broadcast: vi.fn(),
    }
    const ws = { send: vi.fn() }

    const incoming = encoding.createEncoder()
    encoding.writeVarUint(incoming, MSG_SYNC)
    encoding.writeVarUint(incoming, 2) // sync update subtype
    // Missing update payload bytes intentionally

    expect(() => handleMessage(encoding.toUint8Array(incoming), room as never, ws as never)).toThrow(
      'Failed to decode sync update payload',
    )
  })
})
