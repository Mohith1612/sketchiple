import { create } from 'zustand'

export interface RubberBand {
  startX: number
  startY: number
  endX: number
  endY: number
}

interface SelectionStore {
  selectedIds: Set<string>
  rubberBand: RubberBand | null

  selectOne: (id: string) => void
  addToSelection: (id: string) => void
  toggleSelection: (id: string) => void
  selectMany: (ids: string[]) => void
  deselectAll: () => void
  /** Called by shapeStore observer when a remote delete removes a selected shape */
  removeFromSelection: (id: string) => void
  setRubberBand: (rb: RubberBand | null) => void
}

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  selectedIds: new Set(),
  rubberBand: null,

  selectOne: (id) => set({ selectedIds: new Set([id]) }),

  addToSelection: (id) =>
    set((s) => ({ selectedIds: new Set([...s.selectedIds, id]) })),

  toggleSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { selectedIds: next }
    }),

  selectMany: (ids) => set({ selectedIds: new Set(ids) }),

  deselectAll: () => set({ selectedIds: new Set(), rubberBand: null }),

  removeFromSelection: (id) => {
    const { selectedIds } = get()
    if (!selectedIds.has(id)) return
    const next = new Set(selectedIds)
    next.delete(id)
    set({ selectedIds: next })
  },

  setRubberBand: (rb) => set({ rubberBand: rb }),
}))
