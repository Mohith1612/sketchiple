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
import { newId } from '../../lib/uuid.js'

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
  const { shapes } = useShapeStore.getState()
  ydoc.transact(() => {
    getShapesMap().delete(id)
    // Unbind any arrows whose endpoints were bound to this shape
    for (const shape of Object.values(shapes)) {
      if (shape.type !== 'arrow') continue
      if (shape.fromShapeId !== id && shape.toShapeId !== id) continue
      const patched = { ...shape }
      if (patched.fromShapeId === id) {
        delete patched.fromShapeId
        delete patched.fromAnchor
      }
      if (patched.toShapeId === id) {
        delete patched.toShapeId
        delete patched.toAnchor
      }
      getShapesMap().set(shape.id, patched)
    }
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

export function groupSelected(ids: string[]): string | null {
  const { shapes } = useShapeStore.getState()
  const selected = ids
    .map((id) => shapes[id])
    .filter((shape): shape is Shape => Boolean(shape))
  if (selected.length < 2) return null

  const groupId = newId()
  ydoc.transact(() => {
    const map = getShapesMap()
    for (const shape of selected) {
      map.set(shape.id, { ...shape, groupId })
    }
  })

  for (const shape of selected) {
    useShapeStore.getState()._upsertShape({ ...shape, groupId })
  }
  return groupId
}

export function ungroupSelected(ids: string[]): void {
  const { shapes } = useShapeStore.getState()
  const selected = ids
    .map((id) => shapes[id])
    .filter((shape): shape is Shape => Boolean(shape))
  if (selected.length === 0) return

  ydoc.transact(() => {
    const map = getShapesMap()
    for (const shape of selected) {
      const updated = { ...shape }
      delete updated.groupId
      map.set(shape.id, updated)
    }
  })

  for (const shape of selected) {
    const updated = { ...shape }
    delete updated.groupId
    useShapeStore.getState()._upsertShape(updated)
  }
}

export function alignSelected(ids: string[], mode: AlignMode): void {
  const { shapes } = useShapeStore.getState()
  const selected = ids
    .map((id) => shapes[id])
    .filter((shape): shape is Shape => Boolean(shape))
  if (selected.length < 2) return

  const minX = Math.min(...selected.map((s) => s.x))
  const maxX = Math.max(...selected.map((s) => s.x + s.width))
  const minY = Math.min(...selected.map((s) => s.y))
  const maxY = Math.max(...selected.map((s) => s.y + s.height))
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  const updates: Shape[] = selected.map((shape) => {
    let targetX = shape.x
    let targetY = shape.y

    if (mode === 'left') targetX = minX
    if (mode === 'hcenter') targetX = centerX - shape.width / 2
    if (mode === 'right') targetX = maxX - shape.width
    if (mode === 'top') targetY = minY
    if (mode === 'vcenter') targetY = centerY - shape.height / 2
    if (mode === 'bottom') targetY = maxY - shape.height

    const dx = targetX - shape.x
    const dy = targetY - shape.y
    if (dx === 0 && dy === 0) return shape

    const updated: Shape = {
      ...shape,
      x: targetX,
      y: targetY,
    }
    if (shape.points) {
      updated.points = [
        [shape.points[0][0] + dx, shape.points[0][1] + dy],
        [shape.points[1][0] + dx, shape.points[1][1] + dy],
      ]
    }
    if (shape.freehandPoints) {
      updated.freehandPoints = shape.freehandPoints.map(([x, y]) => [x + dx, y + dy])
    }
    return updated
  })

  ydoc.transact(() => {
    const map = getShapesMap()
    for (const shape of updates) {
      map.set(shape.id, shape)
    }
  })

  for (const shape of updates) {
    useShapeStore.getState()._upsertShape(shape)
  }
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
