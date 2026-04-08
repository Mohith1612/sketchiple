/**
 * uWebSockets.js WebSocket message handler.
 *
 * CRITICAL: The first operation in the `message` callback MUST copy the
 * ArrayBuffer. uWS recycles its internal buffer after the callback returns,
 * making any held reference to `message` read garbage memory.
 */
import type { TemplatedApp } from 'uWebSockets.js'
import { newId } from '@canvas-draw/shared'
import { RoomManager } from '../rooms/RoomManager.js'
import * as protocol from './protocol.js'
import * as awarenessProtocol from 'y-protocols/awareness'
import { allowWsMessage, createWsRateLimitState, type WsRateLimitState } from './rateLimit.js'
import { decGauge, incCounter, incGauge, setGauge } from '../metrics/metrics.js'
import { logger } from '../utils/logger.js'

export interface UserData {
  roomId: string
  userId: string
  rateLimit: WsRateLimitState
}

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LOOPBACK_ORIGIN_PATTERN = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i

const roomManager = new RoomManager()

export function isValidRoomId(roomId: string): boolean {
  return UUID_V7_PATTERN.test(roomId)
}

export function isAllowedWsOrigin(origin: string): boolean {
  const configuredOrigins = process.env.WS_ALLOWED_ORIGINS
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (configuredOrigins?.length) {
    return configuredOrigins.includes(origin)
  }

  return LOOPBACK_ORIGIN_PATTERN.test(origin)
}

export function attachWebSocketHandler(app: TemplatedApp): void {
  app.ws<UserData>('/ws/:roomId', {
    compression: 0,
    maxPayloadLength: 16 * 1024 * 1024,
    idleTimeout: 60,

    upgrade: (res, req, context) => {
      const roomId = req.getParameter(0)
      const origin = req.getHeader('origin')

      if (!isValidRoomId(roomId)) {
        logger.warn('ws upgrade rejected: invalid room id', { roomId })
        res.writeStatus('400 Bad Request').end('Invalid room id')
        return
      }

      if (!origin || !isAllowedWsOrigin(origin)) {
        logger.warn('ws upgrade rejected: disallowed origin', { roomId, origin })
        res.writeStatus('403 Forbidden').end('Origin not allowed')
        return
      }

      const userId = newId()

      res.upgrade<UserData>(
        { roomId, userId, rateLimit: createWsRateLimitState() },
        req.getHeader('sec-websocket-key'),
        req.getHeader('sec-websocket-protocol'),
        req.getHeader('sec-websocket-extensions'),
        context,
      )
    },

    open: (ws) => {
      const { roomId, userId } = ws.getUserData()
      const room = roomManager.getOrCreate(roomId)
      room.addClient(ws)
      incGauge('ws_active_sockets', 1)
      setGauge('rooms_active', roomManager.size)

      logger.info('ws open', { roomId, userId, clients: room.clientCount })

      room.sendToClient(ws, protocol.encodeSyncStep1(room.doc))

      const awarenessStates = room.awareness.getStates()
      if (awarenessStates.size > 0) {
        const update = awarenessProtocol.encodeAwarenessUpdate(
          room.awareness,
          Array.from(awarenessStates.keys()),
        )
        room.sendToClient(ws, protocol.encodeAwareness(update))
      }
    },

    message: (ws, message, _isBinary) => {
      // slice(0) creates an independent copy — uWS recycles the original buffer
      // the moment this callback returns, so any deferred read would be garbage.
      const data = new Uint8Array(message.slice(0))

      const { roomId, rateLimit } = ws.getUserData()
      const room = roomManager.getRoom(roomId)
      if (!room) return

      if (!allowWsMessage(rateLimit)) {
        incCounter('ws_rate_limit_exceeded_total')
        logger.warn('ws message rate limit exceeded', { roomId, userId: ws.getUserData().userId })
        return
      }

      try {
        incCounter('ws_messages_received_total')
        protocol.handleMessage(data, room, ws)
      } catch (err) {
        incCounter('ws_message_errors_total')
        logger.error('ws message error', { roomId, err: String(err) })
      }
    },

    drain: (ws) => {
      const { roomId } = ws.getUserData()
      const room = roomManager.getRoom(roomId)
      if (!room) return
      room.handleDrain(ws)
    },

    close: (ws, code, _message) => {
      const { roomId, userId } = ws.getUserData()
      const room = roomManager.getRoom(roomId)
      if (!room) return

      room.removeClient(ws)
      decGauge('ws_active_sockets', 1)
      logger.info('ws close', { roomId, userId, code, clients: room.clientCount })

      if (room.isEmpty) {
        roomManager.deleteRoom(roomId)
      }

      setGauge('rooms_active', roomManager.size)
    },
  })
}
