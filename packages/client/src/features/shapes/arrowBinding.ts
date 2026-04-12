import type { Shape } from '@canvas-draw/shared'
import { useShapeStore } from '../../store/shapeStore.js'

/**
 * Resolve the actual [start, end] endpoints for an arrow.
 * If the arrow is bound to shapes via fromShapeId/toShapeId, endpoints are
 * computed from the bound shapes' positions at render time — no stored absolute
 * coords need to be updated when shapes move.
 */
export function resolveArrowEndpoints(
  arrow: Shape,
): [[number, number], [number, number]] {
  const { shapes } = useShapeStore.getState()
  const fallbackStart: [number, number] = arrow.points?.[0] ?? [arrow.x, arrow.y]
  const fallbackEnd: [number, number] = arrow.points?.[1] ?? [arrow.x + arrow.width, arrow.y + arrow.height]

  let start: [number, number] = fallbackStart
  let end: [number, number] = fallbackEnd

  if (arrow.fromShapeId) {
    const s = shapes[arrow.fromShapeId]
    if (s) {
      const a = arrow.fromAnchor ?? { x: 0.5, y: 0.5 }
      start = [s.x + s.width * a.x, s.y + s.height * a.y]
    }
  }
  if (arrow.toShapeId) {
    const s = shapes[arrow.toShapeId]
    if (s) {
      const a = arrow.toAnchor ?? { x: 0.5, y: 0.5 }
      end = [s.x + s.width * a.x, s.y + s.height * a.y]
    }
  }

  return [start, end]
}

// ---------------------------------------------------------------------------
// Snap detection
// ---------------------------------------------------------------------------

const SNAP_RADIUS_PX = 8

// Priority order: center → edge midpoints → corners
// "Closest wins" is used to pick the best match; this list is the tiebreaker.
const SNAP_ANCHORS: { x: number; y: number }[] = [
  { x: 0.5, y: 0.5 },
  { x: 0.5, y: 0 },
  { x: 1, y: 0.5 },
  { x: 0.5, y: 1 },
  { x: 0, y: 0.5 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
]

/**
 * Find the nearest shape anchor within radiusPx (default SNAP_RADIUS_PX) of the given world point.
 * Returns null if nothing is close enough.
 *
 * Pass a larger radiusPx when already snapped (hysteresis) to prevent flicker at the boundary.
 */
export function snapToShape(
  worldX: number,
  worldY: number,
  excludeId: string,
  zoom: number,
  offsetX: number,
  offsetY: number,
  radiusPx: number = SNAP_RADIUS_PX,
): { shapeId: string; anchor: { x: number; y: number }; x: number; y: number } | null {
  const { shapes } = useShapeStore.getState()
  const sx = worldX * zoom + offsetX
  const sy = worldY * zoom + offsetY

  let bestDist = radiusPx
  let best: { shapeId: string; anchor: { x: number; y: number }; x: number; y: number } | null = null

  for (const shape of Object.values(shapes)) {
    if (shape.id === excludeId || shape.type === 'arrow' || shape.type === 'freehand') continue
    for (const a of SNAP_ANCHORS) {
      const ax = (shape.x + shape.width * a.x) * zoom + offsetX
      const ay = (shape.y + shape.height * a.y) * zoom + offsetY
      const d = Math.hypot(sx - ax, sy - ay)
      if (d < bestDist) {
        bestDist = d
        // Also return world-space snap position for indicator rendering
        best = {
          shapeId: shape.id,
          anchor: a,
          x: shape.x + shape.width * a.x,
          y: shape.y + shape.height * a.y,
        }
      }
    }
  }

  return best
}
