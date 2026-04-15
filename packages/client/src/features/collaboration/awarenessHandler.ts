/**
 * Awareness handler — bidirectional presence sync.
 *
 * Outbound: local cursor position + viewport → awareness local state
 * Inbound:  awareness changes → presenceStore (drives remote cursor rendering)
 *           + viewport application when in follow mode
 */
import type { CanvasEngine } from '../../canvas/CanvasEngine.js'
import { wsProvider } from '../../crdt/sync.js'
import { usePresenceStore } from '../../store/presenceStore.js'
import { useUiStore } from '../../store/uiStore.js'
import type { UserPresence } from '@canvas-draw/shared'
import { throttle } from '../../lib/throttle.js'

export function initAwareness(canvas: HTMLCanvasElement, engine: CanvasEngine): () => void {
  const { localUserId, localColor } = usePresenceStore.getState()
  const { awareness } = wsProvider

  const { localName } = usePresenceStore.getState()

  // Set initial local state
  awareness.setLocalState({
    userId: localUserId,
    color: localColor,
    cursor: null,
    name: localName,
  } satisfies UserPresence)

  // Throttle cursor + viewport updates to ~30fps so we don't flood the
  // WebSocket channel. Without throttling, pointermove fires at 60+ fps and
  // awareness updates consume the entire rate-limit budget.
  const sendCursor = throttle(
    (x: number, y: number) => { awareness.setLocalStateField('cursor', { x, y }) },
    33,
    { leading: true, trailing: true },
  )

  const sendViewport = throttle(
    (zoom: number, centerX: number, centerY: number) => {
      awareness.setLocalStateField('viewport', { zoom, centerX, centerY })
    },
    33,
    { leading: true, trailing: true },
  )

  // Outbound: viewport change → awareness viewport (throttled)
  // Subscribe to uiStore viewport so any navigation (pan, zoom, follow) is broadcast.
  const unsubViewport = useUiStore.subscribe((state) => {
    const { zoom, offsetX, offsetY } = state.viewport
    const centerX = (engine.logicalWidth / 2 - offsetX) / zoom
    const centerY = (engine.logicalHeight / 2 - offsetY) / zoom
    sendViewport(zoom, centerX, centerY)
  })

  // Outbound: pointer move → awareness cursor (throttled)
  function onPointerMove(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const { x, y } = useUiStore.getState().screenToWorld(sx, sy)
    sendCursor(x, y)
  }

  function onPointerLeave() {
    sendCursor.flush()
    sendCursor.cancel()
    awareness.setLocalStateField('cursor', null)
  }

  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerleave', onPointerLeave)

  return () => {
    sendCursor.flush()
    sendCursor.cancel()
    sendViewport.flush()
    sendViewport.cancel()
    unsubViewport()
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerleave', onPointerLeave)
  }
}
