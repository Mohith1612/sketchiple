/**
 * y-protocols binary message encode/decode for uWebSockets.js.
 *
 * Outer framing:
 *   byte 0: MSG_SYNC (0) or MSG_AWARENESS (1)
 *   remaining bytes: y-protocols payload
 *
 * IMPORTANT: All Uint8Array inputs must already be copies of the uWS buffer.
 * Never pass a raw uWS message reference to any function here.
 */
import type * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import { MSG_SYNC, MSG_AWARENESS } from '@canvas-draw/shared'
import type { Room } from '../rooms/Room.js'
import type { WebSocket } from 'uWebSockets.js'
import type { UserData } from './handler.js'
import { incCounter } from '../metrics/metrics.js'

const MAX_AWARENESS_UPDATE_BYTES = parsePositiveInt(
  process.env.WS_MAX_AWARENESS_UPDATE_BYTES,
  128 * 1024,
)

class ProtocolValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProtocolValidationError'
  }
}

// ---------------------------------------------------------------------------
// Outbound encoders
// ---------------------------------------------------------------------------

export function encodeSyncStep1(doc: Y.Doc): Uint8Array {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, MSG_SYNC)
  syncProtocol.writeSyncStep1(enc, doc)
  return toUint8ArraySafe(encoding.toUint8Array(enc))
}

export function encodeSyncStep2(doc: Y.Doc, sv: Uint8Array): Uint8Array {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, MSG_SYNC)
  syncProtocol.writeSyncStep2(enc, doc, sv)
  return toUint8ArraySafe(encoding.toUint8Array(enc))
}

export function encodeAwareness(update: Uint8Array): Uint8Array {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, MSG_AWARENESS)
  encoding.writeVarUint8Array(enc, update)
  return toUint8ArraySafe(encoding.toUint8Array(enc))
}

// ---------------------------------------------------------------------------
// Inbound handler
// ---------------------------------------------------------------------------

export function handleMessage(
  data: Uint8Array, // MUST be a copy — not the raw uWS ArrayBuffer
  room: Room,
  ws: WebSocket<UserData>,
): void {
  if (data.byteLength === 0) {
    throw new ProtocolValidationError('Empty WS payload')
  }

  const dec = decoding.createDecoder(data)
  const msgType = safeReadVarUint(dec, 'outer message type')

  if (msgType === MSG_SYNC) {
    incCounter('ws_sync_messages_total')
    const replyEnc = encoding.createEncoder()
    encoding.writeVarUint(replyEnc, MSG_SYNC)

    // syncProtocol.readSyncMessage reads the sync sub-type and handles it.
    // If it produces a reply (e.g., syncStep2 in response to syncStep1),
    // it writes into replyEnc and returns the sub-type.
    const syncMsgTypeRaw: unknown = safeReadSyncMessage(dec, replyEnc, room.doc, ws)
    const syncMsgType = typeof syncMsgTypeRaw === 'number' ? syncMsgTypeRaw : -1

    if (syncMsgType !== 0 && syncMsgType !== 1 && syncMsgType !== 2) {
      throw new ProtocolValidationError(`Invalid sync message subtype: ${String(syncMsgTypeRaw)}`)
    }

    if (decoding.hasContent(dec)) {
      throw new ProtocolValidationError('Unexpected trailing bytes in SYNC payload')
    }

    // Send reply if the encoder has content (> 1 byte: the MSG_SYNC prefix)
    if (encoding.length(replyEnc) > 1) {
      ws.send(toUint8ArraySafe(encoding.toUint8Array(replyEnc)), true)
    }

    // If this was a doc update (type 2), broadcast to other clients
    if (syncMsgType === 2) {
      // Re-encode the update for broadcast
      const dec2 = decoding.createDecoder(data)
      safeReadVarUint(dec2, 'outer sync prefix') // skip outer MSG_SYNC
      safeReadVarUint(dec2, 'sync subtype') // skip inner update type
      const update = safeReadVarUint8Array(dec2, 'sync update payload')
      if (update.byteLength === 0) {
        throw new ProtocolValidationError('SYNC update payload is empty')
      }
      if (decoding.hasContent(dec2)) {
        throw new ProtocolValidationError('Unexpected trailing bytes in SYNC update payload')
      }
      const broadcastMsg = encodeSyncUpdateBroadcast(update)
      room.broadcast(broadcastMsg, ws)
    }
  } else if (msgType === MSG_AWARENESS) {
    incCounter('ws_awareness_messages_total')
    const update = safeReadVarUint8Array(dec, 'awareness payload')
    if (update.byteLength === 0) {
      throw new ProtocolValidationError('AWARENESS payload is empty')
    }
    if (update.byteLength > MAX_AWARENESS_UPDATE_BYTES) {
      throw new ProtocolValidationError(`AWARENESS payload too large: ${update.byteLength}`)
    }
    if (decoding.hasContent(dec)) {
      throw new ProtocolValidationError('Unexpected trailing bytes in AWARENESS payload')
    }
    awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws)
    // Broadcast to ALL clients including sender (awareness is reflected back)
    const msg = encodeAwareness(update)
    room.broadcast(msg)
  } else {
    throw new ProtocolValidationError(`Unknown outer message type: ${msgType}`)
  }
}

function encodeSyncUpdateBroadcast(update: Uint8Array): Uint8Array {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, MSG_SYNC)
  encoding.writeVarUint(enc, 2) // messageYjsUpdate
  encoding.writeVarUint8Array(enc, update)
  return toUint8ArraySafe(encoding.toUint8Array(enc))
}

function toUint8ArraySafe(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  throw new Error('Expected Uint8Array payload')
}

function safeReadVarUint(dec: decoding.Decoder, label: string): number {
  try {
    return decoding.readVarUint(dec)
  } catch {
    throw new ProtocolValidationError(`Failed to decode ${label}`)
  }
}

function safeReadVarUint8Array(dec: decoding.Decoder, label: string): Uint8Array {
  try {
    return toUint8ArraySafe(decoding.readVarUint8Array(dec))
  } catch {
    throw new ProtocolValidationError(`Failed to decode ${label}`)
  }
}

function safeReadSyncMessage(
  dec: decoding.Decoder,
  replyEnc: encoding.Encoder,
  doc: Y.Doc,
  ws: WebSocket<UserData>,
): unknown {
  try {
    return syncProtocol.readSyncMessage(dec, replyEnc, doc, ws)
  } catch {
    throw new ProtocolValidationError('Failed to decode SYNC payload')
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}
