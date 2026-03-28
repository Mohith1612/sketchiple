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
  cursor: string
  hoveredId: string | null

  setTool: (tool: Tool) => void
  setViewport: (vp: Partial<Viewport>) => void
  setStrokeColor: (c: string) => void
  setFillColor: (c: string) => void
  setStrokeWidth: (w: number) => void
  setCursor: (c: string) => void
  setHoveredId: (id: string | null) => void
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

  setTool: (tool) => set({ activeTool: tool }),
  setViewport: (vp) => set((s) => ({ viewport: { ...s.viewport, ...vp } })),
  setStrokeColor: (c) => set({ strokeColor: c }),
  setFillColor: (c) => set({ fillColor: c }),
  setStrokeWidth: (w) => set({ strokeWidth: w }),
  setCursor: (c) => set({ cursor: c }),
  setHoveredId: (id) => set({ hoveredId: id }),

  screenToWorld: (sx, sy) => {
    const { zoom, offsetX, offsetY } = get().viewport
    return { x: (sx - offsetX) / zoom, y: (sy - offsetY) / zoom }
  },

  worldToScreen: (wx, wy) => {
    const { zoom, offsetX, offsetY } = get().viewport
    return { x: wx * zoom + offsetX, y: wy * zoom + offsetY }
  },
}))
