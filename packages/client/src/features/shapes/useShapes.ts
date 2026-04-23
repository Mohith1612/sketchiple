import { useShapeStore } from '../../store/shapeStore.js'

export function useShapes() {
  return useShapeStore((s) => s.shapes)
}
