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
  const pasted = clipboard.map((s) => {
    const c: Shape = { ...s, id: newId(), x: s.x + PASTE_OFFSET, y: s.y + PASTE_OFFSET }
    return c
  })
  ydoc.transact(() => {
    pasted.forEach((s) => getShapesMap().set(s.id, s))
  })
  pasted.forEach((s) => useShapeStore.getState()._upsertShape(s))
  useSelectionStore.getState().selectMany(pasted.map((s) => s.id))
}
