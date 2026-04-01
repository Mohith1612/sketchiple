import type { Shape } from '@canvas-draw/shared'

/** Renders a single shape onto a CanvasRenderingContext2D. Pure function. */
export function renderShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
  ctx.save()
  ctx.globalAlpha = shape.opacity
  ctx.strokeStyle = shape.stroke
  ctx.fillStyle = shape.fill
  ctx.lineWidth = shape.strokeWidth

  switch (shape.type) {
    case 'rect':
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
      break

    case 'ellipse': {
      const cx = shape.x + shape.width / 2
      const cy = shape.y + shape.height / 2
      const rx = Math.abs(shape.width / 2)
      const ry = Math.abs(shape.height / 2)
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      break
    }

    default:
      break
  }
  ctx.restore()
}
