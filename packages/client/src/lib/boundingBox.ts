import type { Shape } from '@canvas-draw/shared'

export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

/** Returns the axis-aligned bounding box for any shape type. */
export function getBoundingBox(shape: Shape): BBox {
  switch (shape.type) {
    case 'rect':
    case 'ellipse':
      return { x: shape.x, y: shape.y, width: shape.width, height: shape.height }

    case 'text':
      // Use stored dimensions (written at commit time by TextHandler)
      return { x: shape.x, y: shape.y, width: shape.width || 200, height: shape.height || 40 }

    case 'arrow': {
      const pts = shape.points ?? [[shape.x, shape.y], [shape.x, shape.y]] as [[number, number], [number, number]]
      const minX = Math.min(pts[0][0], pts[1][0])
      const minY = Math.min(pts[0][1], pts[1][1])
      return {
        x: minX,
        y: minY,
        width: Math.abs(pts[1][0] - pts[0][0]),
        height: Math.abs(pts[1][1] - pts[0][1]),
      }
    }

    case 'freehand': {
      const pts = shape.freehandPoints ?? []
      if (!pts.length) return { x: shape.x, y: shape.y, width: 0, height: 0 }
      const xs = pts.map(p => p[0])
      const ys = pts.map(p => p[1])
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    }
  }
}
