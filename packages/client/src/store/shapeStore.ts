import { create } from 'zustand'
import type { Shape } from '@canvas-draw/shared'

interface ShapeStore {
  shapes: Record<string, Shape>

  // Internal setters — used by Yjs bridge and ShapeActions
  _setShapes: (shapes: Record<string, Shape>) => void
  _upsertShape: (shape: Shape) => void
  _deleteShape: (id: string) => void
}

export const useShapeStore = create<ShapeStore>((set) => ({
  shapes: {},

  _setShapes: (shapes) => set({ shapes }),

  _upsertShape: (shape) =>
    set((s) => ({ shapes: { ...s.shapes, [shape.id]: shape } })),

  _deleteShape: (id) =>
    set((s) => {
      const next = { ...s.shapes }
      delete next[id]
      return { shapes: next }
    }),
}))
