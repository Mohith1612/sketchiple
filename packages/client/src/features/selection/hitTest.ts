import type { Shape } from '@canvas-draw/shared'
import type { Viewport } from '../../store/uiStore.js'
import { getBoundingBox } from '../../lib/boundingBox.js'

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

const HANDLE_HIT_RADIUS = 6 // px, screen-space, constant regardless of zoom

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

    case 'arrow': {
      const pts = shape.points
      if (!pts) return false
      const [p0, p1] = pts
      const tolerance = shape.strokeWidth / 2 + 6
      return distPointToSegment(wx, wy, p0[0], p0[1], p1[0], p1[1]) <= tolerance
    }

    case 'text':
      // Use stored width/height (written at commit time by TextHandler)
      return (
        wx >= shape.x &&
        wx <= shape.x + (shape.width || 200) &&
        wy >= shape.y &&
        wy <= shape.y + (shape.height || 40)
      )

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

// ---------------------------------------------------------------------------
// Screen-space handle hit test
// ---------------------------------------------------------------------------

/**
 * Returns which corner handle was hit, or null.
 * Handles are 8×8px squares at shape corners, constant screen size.
 * Must be called BEFORE hitTestShapes — handles take priority.
 */
export function hitTestHandle(
  shape: Shape,
  sx: number,
  sy: number,
  vp: Viewport,
): ResizeHandle | null {
  const { zoom, offsetX, offsetY } = vp
  const corners: [ResizeHandle, number, number][] = [
    ['nw', shape.x,              shape.y             ],
    ['ne', shape.x + shape.width, shape.y             ],
    ['sw', shape.x,              shape.y + shape.height],
    ['se', shape.x + shape.width, shape.y + shape.height],
  ]
  // Text and freehand shapes have no resize handles
  if (shape.type === 'arrow' || shape.type === 'text' || shape.type === 'freehand') return null

  for (const [handle, wx, wy] of corners) {
    const hsx = wx * zoom + offsetX
    const hsy = wy * zoom + offsetY
    if (Math.abs(sx - hsx) <= HANDLE_HIT_RADIUS && Math.abs(sy - hsy) <= HANDLE_HIT_RADIUS) {
      return handle
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Selection bounds
// ---------------------------------------------------------------------------

/** Combined AABB of multiple shapes. Returns null if the array is empty. */
export function getSelectionBounds(
  shapes: Shape[],
): { x: number; y: number; width: number; height: number } | null {
  if (shapes.length === 0) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of shapes) {
    minX = Math.min(minX, s.x)
    minY = Math.min(minY, s.y)
    maxX = Math.max(maxX, s.x + s.width)
    maxY = Math.max(maxY, s.y + s.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

// ---------------------------------------------------------------------------
// Rubber-band: shapes intersecting a world-space rectangle
// ---------------------------------------------------------------------------

/**
 * Returns shapes whose AABB INTERSECTS the query rectangle.
 * (Not fully-contained — intersection is more ergonomic.)
 */
export function shapesInRect(
  shapes: Record<string, Shape>,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): Shape[] {
  // Normalise rect so width/height are always positive
  const x1 = rw >= 0 ? rx : rx + rw
  const y1 = rh >= 0 ? ry : ry + rh
  const x2 = x1 + Math.abs(rw)
  const y2 = y1 + Math.abs(rh)

  return Object.values(shapes).filter((s) => {
    const sx2 = s.x + s.width
    const sy2 = s.y + s.height
    return s.x < x2 && sx2 > x1 && s.y < y2 && sy2 > y1
  })
}

// ---------------------------------------------------------------------------
// Resize anchor helper
// ---------------------------------------------------------------------------

/**
 * Returns the world-space coordinates of the fixed (opposite) corner when
 * dragging a resize handle.
 *
 * nw dragged → se is fixed, etc.
 */
export function getResizeAnchor(
  shape: Shape,
  handle: ResizeHandle,
): { ax: number; ay: number } {
  switch (handle) {
    case 'nw': return { ax: shape.x + shape.width,  ay: shape.y + shape.height }
    case 'ne': return { ax: shape.x,                ay: shape.y + shape.height }
    case 'sw': return { ax: shape.x + shape.width,  ay: shape.y              }
    case 'se': return { ax: shape.x,                ay: shape.y              }
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers (exported for reuse)
// ---------------------------------------------------------------------------

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
