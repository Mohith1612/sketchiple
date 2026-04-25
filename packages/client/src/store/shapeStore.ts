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

/**
 * Wire the Yjs observer → Zustand bridge.
 * Call once after ydoc is initialized (in main.tsx after persistence.whenSynced).
 *
 * Key invariant: if `transaction.local === true`, the change originated from
 * ShapeActions which already updated Zustand directly — skip to avoid double-update.
 */
export function initShapeStoreSync(): void {
  // Lazy import to avoid circular dependency at module load time
  void import('../crdt/doc.js').then(({ getShapesMap }) => {
    const shapesMap = getShapesMap()

    shapesMap.observe((event, transaction) => {
      if (transaction.local) return // ShapeActions already updated Zustand

      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add' || change.action === 'update') {
          const shape = shapesMap.get(key)
          if (shape) {
            useShapeStore.getState()._upsertShape(shape)
            // Mark for lerp smoothing (lazy import avoids circular deps at load time)
            void import('../canvas/CanvasRenderer.js').then(({ markRemoteUpdate }) => {
              markRemoteUpdate(shape.id, shape.x, shape.y)
            })
          }
        } else if (change.action === 'delete') {
          useShapeStore.getState()._deleteShape(key)
          // Purge deleted shape from selection and lerp cache
          void import('../features/selection/selectionStore.js').then(({ useSelectionStore }) => {
            useSelectionStore.getState().removeFromSelection(key)
          })
          void import('../canvas/CanvasRenderer.js').then(({ clearRemoteLerpPos }) => {
            clearRemoteLerpPos(key)
          })
          // Cancel in-progress draft if the remote peer deleted the shape we're drawing
          void import('../features/drawing/DrawingHandler.js').then(({ currentDraftId, cancelCurrentDraft }) => {
            if (key === currentDraftId) cancelCurrentDraft()
          })
        }
      })
    })
  })
}
