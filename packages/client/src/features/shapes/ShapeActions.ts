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

export function addShape(shape: Shape): void {
  ydoc.transact(() => {
    getShapesMap().set(shape.id, shape)
  })
  // Direct Zustand update for zero-latency local feedback
  useShapeStore.getState()._upsertShape(shape)
}
