/**
 * CanvasRenderer — orchestrates the full scene render each RAF frame.
 * Renders: background → shapes → draft → selection overlay → remote cursors
 */
import { renderShape } from '../features/shapes/ShapeRenderer.js'
import { useShapeStore } from '../store/shapeStore.js'
import { useUiStore } from '../store/uiStore.js'
import { getBoundingBox } from '../lib/boundingBox.js'
import type { DraftShape } from '../features/drawing/DrawingHandler.js'
import type { Shape } from '@canvas-draw/shared'

export function renderScene(ctx: CanvasRenderingContext2D, draft: DraftShape | null): void {
  const { shapes } = useShapeStore.getState()
  const { viewport } = useUiStore.getState()
  const { zoom, offsetX, offsetY } = viewport

  // Background
  ctx.fillStyle = '#f8f9fa'
  ctx.fillRect(0, 0, ctx.canvas.clientWidth, ctx.canvas.clientHeight)

  // Apply viewport transform
  ctx.save()
  ctx.translate(offsetX, offsetY)
  ctx.scale(zoom, zoom)

  const canvasW = ctx.canvas.clientWidth
  const canvasH = ctx.canvas.clientHeight
  for (const shape of Object.values(shapes)) {
    if (!isShapeVisible(shape, zoom, offsetX, offsetY, canvasW, canvasH)) continue
    renderShape(ctx, shape)
  }

  ctx.restore()

  void draft // draft rendering added later
}

function isShapeVisible(
  shape: Shape,
  zoom: number,
  offsetX: number,
  offsetY: number,
  canvasW: number,
  canvasH: number,
): boolean {
  const bbox = getBoundingBox(shape)
  const inflate = Math.max(20, (shape.strokeWidth ?? 2) * 2)
  const sx = (bbox.x - inflate) * zoom + offsetX
  const sy = (bbox.y - inflate) * zoom + offsetY
  const sw = (bbox.width + inflate * 2) * zoom
  const sh = (bbox.height + inflate * 2) * zoom
  const MARGIN = 50
  return sx + sw > -MARGIN && sy + sh > -MARGIN && sx < canvasW + MARGIN && sy < canvasH + MARGIN
}
