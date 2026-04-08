/**
 * ConnectionStatus — small fixed indicator shown when WebSocket is not SYNCED.
 *
 * Hidden when connected. Appears after a 1-second delay to avoid flicker on
 * fast initial connects.
 */
import { useEffect, useState } from 'react'
import { useUiStore } from '../../store/uiStore.js'

const STATUS_MAP = {
  CONNECTING:   { text: 'Connecting…',  color: '#f59e0b' },
  HANDSHAKING:  { text: 'Syncing…',     color: '#f59e0b' },
  DISCONNECTED: { text: 'Offline',      color: '#ef4444' },
} as const

export function ConnectionStatus() {
  const wsState = useUiStore((s) => s.wsState)
  const reconnectAttempt = useUiStore((s) => s.wsReconnectAttempt)
  const nextRetryMs = useUiStore((s) => s.wsNextRetryMs)
  const maxReconnectAttempts = useUiStore((s) => s.wsMaxReconnectAttempts)
  const retriesExhausted = useUiStore((s) => s.wsRetriesExhausted)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (wsState === 'SYNCED') {
      setVisible(false)
      return
    }
    // Delay appearance to avoid flicker on fast initial connects
    const t = setTimeout(() => setVisible(true), 1000)
    return () => clearTimeout(t)
  }, [wsState])

  if (!visible || wsState === 'SYNCED') return null

  const { color } = STATUS_MAP[wsState]
  let text: string = STATUS_MAP[wsState].text
  if (wsState === 'DISCONNECTED') {
    if (retriesExhausted) {
      text = `Offline (retries exhausted after ${maxReconnectAttempts} attempts)`
    } else if (nextRetryMs !== null && reconnectAttempt > 0) {
      const secs = Math.max(1, Math.ceil(nextRetryMs / 1000))
      text = `Reconnecting in ${secs}s (${reconnectAttempt}/${maxReconnectAttempts})`
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: '#fff',
        borderRadius: 6,
        padding: '4px 10px',
        boxShadow: '0 1px 8px rgba(0,0,0,0.12)',
        fontSize: 12,
        fontFamily: 'system-ui, sans-serif',
        color: '#334155',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {text}
    </div>
  )
}
