import type { Shape } from '@canvas-draw/shared'
import { newId } from '../../lib/uuid.js'
import { ydoc, getShapesMap } from '../../crdt/doc.js'
import { useShapeStore } from '../../store/shapeStore.js'
import { useSelectionStore } from '../selection/selectionStore.js'
import { useClipboardStore } from './clipboardStore.js'

const PASTE_OFFSET = 10

export function copySelected(): void {
  const { selectedIds } = useSelectionStore.getState()
  const { shapes } = useShapeStore.getState()
  const copied = [...selectedIds].map((id) => shapes[id]).filter(Boolean) as Shape[]
  useClipboardStore.getState().setClipboard(copied)
}

export function pasteClipboard(): void {
  const { clipboard } = useClipboardStore.getState()
  if (!clipboard.length) return
  const pasted = clipboard.map((s) => cloneWithOffset(s, PASTE_OFFSET, PASTE_OFFSET))
  ydoc.transact(() => {
    pasted.forEach((s) => getShapesMap().set(s.id, s))
  })
  pasted.forEach((s) => useShapeStore.getState()._upsertShape(s))
  useSelectionStore.getState().selectMany(pasted.map((s) => s.id))
}

export function duplicate(): void {
  const { selectedIds } = useSelectionStore.getState()
  const { shapes } = useShapeStore.getState()
  const selected = [...selectedIds].map((id) => shapes[id]).filter(Boolean) as Shape[]
  if (!selected.length) return
  const duped = selected.map((s) => cloneWithOffset(s, PASTE_OFFSET, PASTE_OFFSET))
  ydoc.transact(() => {
    duped.forEach((s) => getShapesMap().set(s.id, s))
  })
  duped.forEach((s) => useShapeStore.getState()._upsertShape(s))
  useSelectionStore.getState().selectMany(duped.map((s) => s.id))
}

function cloneWithOffset(shape: Shape, dx: number, dy: number): Shape {
  // structuredClone guarantees no shared references for freehandPoints arrays and anchor objects
  const c: Shape = structuredClone(shape)
  c.id = newId()
  c.x += dx
  c.y += dy
  if (c.points) {
    c.points = [
      [c.points[0][0] + dx, c.points[0][1] + dy],
      [c.points[1][0] + dx, c.points[1][1] + dy],
    ]
  }
  if (c.freehandPoints) {
    c.freehandPoints = c.freehandPoints.map(([x, y]) => [x + dx, y + dy])
  }
  return c
}
