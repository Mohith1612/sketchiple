/**
 * SelectionRenderer — draws the selection overlay in screen-space.
 *
 * Renders:
 *  - Blue dashed border around each selected shape
 *  - 4 corner resize handles (8×8px white squares with blue border)
 *  - Rubber-band rectangle while dragging
 *
 * Called AFTER ctx.restore() in CanvasRenderer so everything is screen-space.
 */
import type { Shape } from '@canvas-draw/shared'
import type { RubberBand } from './selectionStore.js'
import type { Viewport } from '../../store/uiStore.js'
import { useUiStore } from '../../store/uiStore.js'
import { useShapeStore } from '../../store/shapeStore.js'

const SELECTION_COLOR = '#6366f1'
const HANDLE_SIZE = 8 // px, screen-space

export function renderSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  selectedShapes: Shape[],
  rubberBand: RubberBand | null,
  vp: Viewport,
): void {
  const { zoom, offsetX, offsetY } = vp

  ctx.save()

  // --- Hover highlight (non-selected shape under pointer) ---
  const { hoveredId } = useUiStore.getState()
  if (hoveredId) {
    const { shapes } = useShapeStore.getState()
    const hovered = shapes[hoveredId]
    if (hovered && !selectedShapes.find((s) => s.id === hoveredId)) {
      const hsx = hovered.x * zoom + offsetX
      const hsy = hovered.y * zoom + offsetY
      const hsw = hovered.width * zoom
      const hsh = hovered.height * zoom
      ctx.beginPath()
      ctx.rect(hsx - 2, hsy - 2, hsw + 4, hsh + 4)
      ctx.setLineDash([])
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgba(99,102,241,0.45)'
      ctx.stroke()
    }
  }

  // Determine if group resize mode applies:
  // all selected shapes must be resizable (no arrows/text/freehand) and count ≥ 2
  const resizableSelected = selectedShapes.filter((s) => s.type !== 'arrow' && s.type !== 'text' && s.type !== 'freehand')
  const groupMode = resizableSelected.length >= 2 && resizableSelected.length === selectedShapes.length

  // --- Selected shape outlines + per-shape handles (suppressed in group mode) ---
  for (const shape of selectedShapes) {
    // Convert world-space bounding box to screen-space
    const sx = shape.x * zoom + offsetX
    const sy = shape.y * zoom + offsetY
    const sw = shape.width * zoom
    const sh = shape.height * zoom

    // Dashed blue border
    ctx.beginPath()
    ctx.rect(sx, sy, sw, sh)
    ctx.setLineDash([4, 3])
    ctx.lineWidth = 1.5
    ctx.strokeStyle = SELECTION_COLOR
    ctx.stroke()
    ctx.setLineDash([])

    // Per-shape corner handles — only when NOT in group mode
    if (shape.type !== 'arrow' && !groupMode) {
      const corners: [number, number][] = [
        [sx, sy],
        [sx + sw, sy],
        [sx, sy + sh],
        [sx + sw, sy + sh],
      ]
      for (const [hx, hy] of corners) {
        const half = HANDLE_SIZE / 2
        ctx.fillStyle = '#fff'
        ctx.strokeStyle = SELECTION_COLOR
        ctx.lineWidth = 1.5
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.rect(hx - half, hy - half, HANDLE_SIZE, HANDLE_SIZE)
        ctx.fill()
        ctx.stroke()
      }
    }
  }

  // --- Group bbox + handles (group mode only) ---
  if (groupMode) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const s of resizableSelected) {
      minX = Math.min(minX, s.x);          minY = Math.min(minY, s.y)
      maxX = Math.max(maxX, s.x + s.width); maxY = Math.max(maxY, s.y + s.height)
    }
    const gsx = minX * zoom + offsetX
    const gsy = minY * zoom + offsetY
    const gsw = (maxX - minX) * zoom
    const gsh = (maxY - minY) * zoom

    // Group bounding box — solid line, slightly thicker
    ctx.beginPath()
    ctx.rect(gsx, gsy, gsw, gsh)
    ctx.setLineDash([6, 3])
    ctx.lineWidth = 1.5
    ctx.strokeStyle = SELECTION_COLOR
    ctx.stroke()
    ctx.setLineDash([])

    // Group corner handles (same style as per-shape handles)
    for (const [hx, hy] of [[gsx, gsy], [gsx + gsw, gsy], [gsx, gsy + gsh], [gsx + gsw, gsy + gsh]] as [number, number][]) {
      const half = HANDLE_SIZE / 2
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = SELECTION_COLOR
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.rect(hx - half, hy - half, HANDLE_SIZE, HANDLE_SIZE)
      ctx.fill()
      ctx.stroke()
    }
  }

  // --- Rubber-band rectangle ---
  if (rubberBand) {
    const { startX, startY, endX, endY } = rubberBand
    // Convert world → screen
    const x1 = startX * zoom + offsetX
    const y1 = startY * zoom + offsetY
    const x2 = endX * zoom + offsetX
    const y2 = endY * zoom + offsetY

    ctx.beginPath()
    ctx.rect(x1, y1, x2 - x1, y2 - y1)
    ctx.fillStyle = 'rgba(99,102,241,0.1)'
    ctx.fill()
    ctx.setLineDash([])
    ctx.lineWidth = 1
    ctx.strokeStyle = SELECTION_COLOR
    ctx.stroke()
  }

  ctx.restore()
}
