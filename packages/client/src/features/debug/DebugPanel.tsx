/**
 * DebugPanel — dev-only overlay showing live collaboration and perf diagnostics.
 * Only rendered when import.meta.env.DEV is true.
 */
import { useEffect, useState } from 'react'
import { useShapeStore } from '../../store/shapeStore.js'
import { usePresenceStore } from '../../store/presenceStore.js'
import { useUiStore } from '../../store/uiStore.js'
import { wsProvider, type WsState } from '../../crdt/sync.js'
import { ydoc } from '../../crdt/doc.js'
import { perfState } from '../../canvas/CanvasEngine.js'

export function DebugPanel() {
  const shapeCount = useShapeStore((s) => Object.keys(s.shapes).length)
  const remoteUserCount = usePresenceStore((s) => Object.keys(s.remoteUsers).length)
  const reconnectAttempt = useUiStore((s) => s.wsReconnectAttempt)
  const nextRetryMs = useUiStore((s) => s.wsNextRetryMs)
  const maxReconnectAttempts = useUiStore((s) => s.wsMaxReconnectAttempts)
  const retriesExhausted = useUiStore((s) => s.wsRetriesExhausted)
  const [wsState, setWsState] = useState<WsState>(wsProvider.state)
  const [lastSyncMs, setLastSyncMs] = useState<number | null>(null)
  const [fps, setFps] = useState(0)
  const [frameTimeMs, setFrameTimeMs] = useState(0)

  useEffect(() => {
    const unsub = wsProvider.onStateChange(setWsState)
    return unsub
  }, [])

  useEffect(() => {
    const handler = () => setLastSyncMs(Date.now())
    ydoc.on('update', handler)
    return () => ydoc.off('update', handler)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setFps(perfState.fps)
      setFrameTimeMs(perfState.frameTimeMs)
    }, 250)
    return () => clearInterval(id)
  }, [])

  const wsColor: Record<WsState, string> = {
    DISCONNECTED: '#f43f5e',
    CONNECTING: '#f59e0b',
    HANDSHAKING: '#f59e0b',
    SYNCED: '#10b981',
  }

  const age = lastSyncMs ? `${Date.now() - lastSyncMs}ms ago` : 'never'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        background: 'rgba(15,23,42,0.88)',
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: 11,
        padding: '8px 12px',
        borderRadius: 6,
        zIndex: 9999,
        lineHeight: 1.8,
        backdropFilter: 'blur(4px)',
        pointerEvents: 'none',
      }}
    >
      <div>fps: <b style={{ color: fps < 30 ? '#f43f5e' : fps < 50 ? '#f59e0b' : '#10b981' }}>{fps}</b></div>
      <div>frame: <b>{frameTimeMs}ms</b></div>
      <div>shapes: <b>{shapeCount}</b></div>
      <div>users: <b>{remoteUserCount + 1}</b> (incl. you)</div>
      <div>last sync: <b>{age}</b></div>
      <div>
        ws:{' '}
        <b style={{ color: wsColor[wsState] }}>{wsState}</b>
      </div>
      <div>
        reconnect:{' '}
        <b>
          {retriesExhausted
            ? `exhausted (${maxReconnectAttempts})`
            : reconnectAttempt > 0
              ? `${reconnectAttempt}/${maxReconnectAttempts}${nextRetryMs !== null ? ` in ${Math.max(1, Math.ceil(nextRetryMs / 1000))}s` : ''}`
              : 'idle'}
        </b>
      </div>
    </div>
  )
}
