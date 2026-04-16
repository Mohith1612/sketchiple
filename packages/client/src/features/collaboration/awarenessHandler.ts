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
import { clearCursorPos } from '../../canvas/CanvasRenderer.js'
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

  // Inbound: awareness change → presenceStore + follow mode
  function onAwarenessChange({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) {
    const store = usePresenceStore.getState()
    const uiStore = useUiStore.getState()

    for (const clientId of [...added, ...updated]) {
      const state = awareness.getStates().get(clientId) as UserPresence | undefined
      if (!state?.userId || state.userId === localUserId) continue
      store._upsertRemoteUser({ ...state, userId: state.userId })

      // Apply remote viewport when following this user.
      // Use world-center projection so different canvas sizes work correctly.
      if (state.userId === uiStore.followingUserId && state.viewport) {
        const { zoom, centerX, centerY } = state.viewport
        uiStore._setViewportFromFollow({
          zoom,
          offsetX: engine.logicalWidth / 2 - centerX * zoom,
          offsetY: engine.logicalHeight / 2 - centerY * zoom,
        })
        engine.requestRender()
      }
    }

    for (const clientId of removed) {
      const state = awareness.getStates().get(clientId) as UserPresence | undefined
      if (state?.userId) {
        store._removeRemoteUser(state.userId)
        clearCursorPos(state.userId)
        // Cancel follow if the user we were following disconnected
        if (state.userId === useUiStore.getState().followingUserId) {
          useUiStore.getState().setFollowing(null)
        }
      }
    }

    engine.requestRender()
  }

  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerleave', onPointerLeave)
  awareness.on('change', onAwarenessChange)

  // Hide cursor when tab is hidden
  function onVisibilityChange() {
    if (document.hidden) {
      awareness.setLocalStateField('cursor', null)
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    sendCursor.flush()
    sendCursor.cancel()
    sendViewport.flush()
    sendViewport.cancel()
    unsubViewport()
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerleave', onPointerLeave)
    awareness.off('change', onAwarenessChange)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
