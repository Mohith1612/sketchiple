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

  setTool: (tool: Tool) => void
  setViewport: (vp: Partial<Viewport>) => void
}

export const useUiStore = create<UiStore>((set) => ({
  activeTool: 'rect',
  viewport: { zoom: 1, offsetX: 0, offsetY: 0 },

  setTool: (tool) => set({ activeTool: tool }),
  setViewport: (vp) => set((s) => ({ viewport: { ...s.viewport, ...vp } })),
}))
