import type { Shape } from '@canvas-draw/shared'
import { useShapeStore } from '../../store/shapeStore.js'
import { useSelectionStore } from '../selection/selectionStore.js'

export function getShapesForExport(selectedOnly: boolean): Shape[] {
  const { shapes } = useShapeStore.getState()
  const all = Object.values(shapes)
  if (!selectedOnly) return all

  const selectedIds = useSelectionStore.getState().selectedIds
  if (selectedIds.size === 0) return []
  return all.filter((shape) => selectedIds.has(shape.id))
}
