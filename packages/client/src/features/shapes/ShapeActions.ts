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

/**
 * LOCAL-ONLY update: writes to Zustand only, never touches Yjs.
 * Use for high-frequency pointermove handling to get 60fps local render
 * without flooding the network. Always follow with updateShape() or a
 * throttled Yjs write to persist the final state to peers.
 *
 * INVARIANT: Must never call ydoc or getShapesMap().
 */
export function updateShapeLocal(id: string, patch: Partial<Omit<Shape, 'id'>>): void {
  const current = useShapeStore.getState().shapes[id]
  if (!current) return
  useShapeStore.getState()._upsertShape({ ...current, ...patch })
}

export function bringToFront(ids: string[]): void {
  reorderSelected(ids, (order, selected) => {
    const selectedSet = new Set(selected)
    const rest = order.filter((id) => !selectedSet.has(id))
    return [...rest, ...selected]
  })
}

export function sendToBack(ids: string[]): void {
  reorderSelected(ids, (order, selected) => {
    const selectedSet = new Set(selected)
    const rest = order.filter((id) => !selectedSet.has(id))
    return [...selected, ...rest]
  })
}

export function bringForward(ids: string[]): void {
  reorderSelected(ids, (order, selected) => {
    const selectedSet = new Set(selected)
    const next = [...order]
    for (let i = next.length - 2; i >= 0; i -= 1) {
      if (selectedSet.has(next[i]!) && !selectedSet.has(next[i + 1]!)) {
        const tmp = next[i]!
        next[i] = next[i + 1]!
        next[i + 1] = tmp
      }
    }
    return next
  })
}

export function sendBackward(ids: string[]): void {
  reorderSelected(ids, (order, selected) => {
    const selectedSet = new Set(selected)
    const next = [...order]
    for (let i = 1; i < next.length; i += 1) {
      if (selectedSet.has(next[i]!) && !selectedSet.has(next[i - 1]!)) {
        const tmp = next[i]!
        next[i] = next[i - 1]!
        next[i - 1] = tmp
      }
    }
    return next
  })
}

function reorderSelected(
  ids: string[],
  transform: (order: string[], selectedInOrder: string[]) => string[],
): void {
  const { shapes } = useShapeStore.getState()
  const order = Object.keys(shapes)
  const selectedSet = new Set(ids.filter((id) => shapes[id]))
  if (selectedSet.size === 0) return

  const selectedInOrder = order.filter((id) => selectedSet.has(id))
  if (selectedInOrder.length === 0) return

  const nextOrder = transform(order, selectedInOrder)
  if (nextOrder.length !== order.length) return
  if (nextOrder.every((id, index) => id === order[index])) return

  ydoc.transact(() => {
    const map = getShapesMap()
    const orderedShapes: Shape[] = nextOrder
      .map((id) => shapes[id])
      .filter((shape): shape is Shape => Boolean(shape))
    map.clear()
    for (const shape of orderedShapes) {
      map.set(shape.id, shape)
    }
  })

  const nextShapes: Record<string, Shape> = {}
  for (const id of nextOrder) {
    const shape = shapes[id]
    if (shape) nextShapes[id] = shape
  }
  useShapeStore.getState()._setShapes(nextShapes)
}
