/**
 * ShapeActions — the single write path for shape mutations.
 *
 * Writes to Yjs (which broadcasts to other clients), then updates Zustand
 * directly for immediate local feedback without waiting for the observer.
 * The observer skips local transactions via `transaction.local === true`.
 */
import type { Shape } from '@canvas-draw/shared'
import { ydoc, getShapesMap } from '../../crdt/doc.js'
import { useShapeStore } from '../../store/shapeStore.js'
import { invalidateFreehandPath } from './ShapeRenderer.js'

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'

export function addShape(shape: Shape): void {
  ydoc.transact(() => {
    getShapesMap().set(shape.id, shape)
  })
  // Direct Zustand update for zero-latency local feedback
  useShapeStore.getState()._upsertShape(shape)
}

export function updateShape(id: string, patch: Partial<Omit<Shape, 'id'>>): void {
  const current = useShapeStore.getState().shapes[id]
  if (!current) return
  const updated: Shape = { ...current, ...patch }
  ydoc.transact(() => {
    getShapesMap().set(id, updated)
  })
  useShapeStore.getState()._upsertShape(updated)
}

export function removeShape(id: string): void {
  ydoc.transact(() => {
    getShapesMap().delete(id)
  })
  useShapeStore.getState()._deleteShape(id)
  invalidateFreehandPath(id)
}
