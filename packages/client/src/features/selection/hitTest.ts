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

    // arrow and freehand added next
    case 'arrow':
    case 'freehand':
      return false
  }
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

// Placeholder for getBoundingBox usage in freehand (added in commit 87)
void getBoundingBox
