/**
 * Manual WebSocket provider for Yjs sync with the uWS server.
 *
 * Does NOT use y-websocket — that library is coupled to the ws/Node EventEmitter API.
 * Instead: plain browser WebSocket + y-protocols + lib0.
 *
 * CRITICAL: ws.binaryType = 'arraybuffer' must be set before the first message.
 * Without it the browser defaults to 'blob' and binary data is silently garbled.
 */
import { ydoc } from './doc.js'

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

  constructor() {
    const rawMaxRetries: unknown = import.meta.env.VITE_WS_MAX_RETRIES
    const parsedMaxRetries = typeof rawMaxRetries === 'string' ? Number(rawMaxRetries) : NaN
    this.maxReconnectAttempts = Number.isFinite(parsedMaxRetries) && parsedMaxRetries > 0
      ? Math.floor(parsedMaxRetries)
      : 20
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

    ws.onerror = (err) => {
      console.warn('[ws] error:', err)
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
  }
}

function buildWsUrl(roomId: string): string {
  const rawBase: unknown = import.meta.env.VITE_WS_URL
  const base = typeof rawBase === 'string' ? rawBase : ''
  if (base) return `${base}/ws/${roomId}`
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/${roomId}`
}

// Suppress unused import warning — ydoc is used in later commits
void ydoc

export const wsProvider = new YjsWebSocketProvider()
