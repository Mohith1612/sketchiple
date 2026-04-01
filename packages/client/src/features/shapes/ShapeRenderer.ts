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

    case 'arrow': {
      const pts = shape.points
      if (!pts) break
      const [start, end] = pts
      const [x1, y1] = start
      const [x2, y2] = end
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const headLen = Math.max(12, shape.strokeWidth * 4)

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6))
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6))
      ctx.stroke()
      break
    }

    case 'text': {
      if (!shape.content) break
      const fontSize = shape.fontSize ?? 16
      const fontWeight = shape.fontWeight ?? 'normal'
      const textAlign = shape.textAlign ?? 'left'
      ctx.font = `${fontWeight} ${fontSize}px ${shape.fontFamily ?? 'system-ui, sans-serif'}`
      ctx.fillStyle = shape.stroke
      ctx.textAlign = textAlign
      ctx.textBaseline = 'top'
      const textX = textAlign === 'left' ? shape.x : textAlign === 'center' ? shape.x + shape.width / 2 : shape.x + shape.width
      const lineH = fontSize * 1.4
      shape.content.split('\n').forEach((line, i) => {
        ctx.fillText(line, textX, shape.y + i * lineH)
      })
      break
    }

    default:
      break
  }
  ctx.restore()
}
