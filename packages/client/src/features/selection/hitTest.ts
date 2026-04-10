import type { Shape } from '@canvas-draw/shared'
import { getBoundingBox } from '../../lib/boundingBox.js'

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

// ---------------------------------------------------------------------------
// World-space shape hit tests
// ---------------------------------------------------------------------------

export function hitTestPoint(shape: Shape, wx: number, wy: number): boolean {
  switch (shape.type) {
    case 'rect':
      return wx >= shape.x && wx <= shape.x + shape.width && wy >= shape.y && wy <= shape.y + shape.height

    case 'ellipse': {
      const cx = shape.x + shape.width / 2
      const cy = shape.y + shape.height / 2
      const rx = Math.abs(shape.width / 2)
      const ry = Math.abs(shape.height / 2)
      if (rx === 0 || ry === 0) return false
      return ((wx - cx) / rx) ** 2 + ((wy - cy) / ry) ** 2 <= 1
    }

    case 'text':
      return (
        wx >= shape.x &&
        wx <= shape.x + (shape.width || 200) &&
        wy >= shape.y &&
        wy <= shape.y + (shape.height || 40)
      )

    case 'arrow': {
      const pts = shape.points
      if (!pts) return false
      const [p0, p1] = pts
      const tolerance = shape.strokeWidth / 2 + 6
      return distPointToSegment(wx, wy, p0[0], p0[1], p1[0], p1[1]) <= tolerance
    }

    case 'freehand': {
      const bb = getBoundingBox(shape)
      if (wx < bb.x || wx > bb.x + bb.width || wy < bb.y || wy > bb.y + bb.height) return false
      const threshold = Math.max(5, shape.strokeWidth + 4)
      const pts = shape.freehandPoints ?? []
      for (let i = 0; i < pts.length - 1; i++) {
        if (distPointToSegment(wx, wy, pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1]) <= threshold)
          return true
      }
      return false
    }
  }
}

export function distPointToSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/**
 * Returns the topmost (visually last rendered) shape that contains the point.
 * REVERSE iteration ensures shapes drawn on top win.
 */
export function hitTestShapes(
  shapes: Record<string, Shape>,
  wx: number,
  wy: number,
): Shape | null {
  const all = Object.values(shapes)
  for (let i = all.length - 1; i >= 0; i--) {
    const shape = all[i]
    if (shape && hitTestPoint(shape, wx, wy)) return shape
  }
  return null
}

