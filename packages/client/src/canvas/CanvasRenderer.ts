/**
 * CanvasRenderer — orchestrates the full scene render each RAF frame.
 * Renders: background → shapes → draft → selection overlay → remote cursors
 */
import { renderShape } from '../features/shapes/ShapeRenderer.js'
import { useShapeStore } from '../store/shapeStore.js'
import { useUiStore } from '../store/uiStore.js'
import type { DraftShape } from '../features/drawing/DrawingHandler.js'

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

  for (const shape of Object.values(shapes)) {
    renderShape(ctx, shape)
  }

  ctx.restore()

  void draft // draft rendering added later
}
