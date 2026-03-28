import { create } from 'zustand'
import type { ShapeType } from '@canvas-draw/shared'

export type Tool = ShapeType | 'select' | 'pan'

export interface Viewport {
  zoom: number    // 1.0 = 100%
  offsetX: number // pan in logical pixels
  offsetY: number
}

interface UiStore {
  activeTool: Tool
  viewport: Viewport
  strokeColor: string
  fillColor: string
  strokeWidth: number
  /** CSS cursor value applied to the canvas element */
  cursor: string
  /** ID of shape currently under the pointer (select tool, idle) */
  hoveredId: string | null
  /** WebSocket connection state — drives ConnectionStatus UI */
  wsState: 'DISCONNECTED' | 'CONNECTING' | 'HANDSHAKING' | 'SYNCED'
  /** Reconnect telemetry for user-facing status and debug panel */
  wsReconnectAttempt: number
  wsNextRetryMs: number | null
  wsMaxReconnectAttempts: number
  wsRetriesExhausted: boolean
  /** userId being followed, or null when not in follow mode */
  followingUserId: string | null

  setTool: (tool: Tool) => void
  setViewport: (vp: Partial<Viewport>) => void
  /** Apply a viewport from a followed peer. Does NOT break follow mode. */
  _setViewportFromFollow: (vp: Viewport) => void
  setFollowing: (userId: string | null) => void
  setStrokeColor: (c: string) => void
  setFillColor: (c: string) => void
  setStrokeWidth: (w: number) => void
  setCursor: (c: string) => void
  setHoveredId: (id: string | null) => void
  setWsState: (s: 'DISCONNECTED' | 'CONNECTING' | 'HANDSHAKING' | 'SYNCED') => void
  setWsReconnectMeta: (meta: {
    attempt: number
    nextRetryMs: number | null
    maxAttempts: number
    exhausted: boolean
  }) => void
  screenToWorld: (sx: number, sy: number) => { x: number; y: number }
  worldToScreen: (wx: number, wy: number) => { x: number; y: number }
}

export const useUiStore = create<UiStore>((set, get) => ({
  activeTool: 'rect',
  viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
  strokeColor: '#1a1a2e',
  fillColor: 'rgba(99,102,241,0.15)',
  strokeWidth: 2,
  cursor: 'default',
  hoveredId: null,
  wsState: 'DISCONNECTED',
  wsReconnectAttempt: 0,
  wsNextRetryMs: null,
  wsMaxReconnectAttempts: 20,
  wsRetriesExhausted: false,
  followingUserId: null,

  setTool: (tool) => set({ activeTool: tool }),
  setViewport: (vp) => set((s) => ({ viewport: { ...s.viewport, ...vp } })),
  _setViewportFromFollow: (vp) => set({ viewport: vp }),
  setFollowing: (userId) => set({ followingUserId: userId }),
  setStrokeColor: (c) => set({ strokeColor: c }),
  setFillColor: (c) => set({ fillColor: c }),
  setStrokeWidth: (w) => set({ strokeWidth: w }),
  setCursor: (c) => set({ cursor: c }),
  setHoveredId: (id) => set({ hoveredId: id }),
  setWsState: (s) => set({ wsState: s }),
  setWsReconnectMeta: ({ attempt, nextRetryMs, maxAttempts, exhausted }) =>
    set({
      wsReconnectAttempt: attempt,
      wsNextRetryMs: nextRetryMs,
      wsMaxReconnectAttempts: maxAttempts,
      wsRetriesExhausted: exhausted,
    }),

  screenToWorld: (sx, sy) => {
    const { zoom, offsetX, offsetY } = get().viewport
    return { x: (sx - offsetX) / zoom, y: (sy - offsetY) / zoom }
  },

  worldToScreen: (wx, wy) => {
    const { zoom, offsetX, offsetY } = get().viewport
    return { x: wx * zoom + offsetX, y: wy * zoom + offsetY }
  },
}))
