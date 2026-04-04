import type { DraftShape } from './DrawingHandler.js'
import { useUiStore } from '../../store/uiStore.js'

// ---------------------------------------------------------------------------
// Draft freehand Path2D cache
// The draft path is append-only during drawing; rebuild only when the point
// count changes. Reset automatically when a new drawing session starts (the
// new points array will have a different length).
// ---------------------------------------------------------------------------

let _draftPath: Path2D | null = null
let _draftPathLen = 0

function getFreehandDraftPath(pts: [number, number][]): Path2D {
  if (_draftPath && pts.length === _draftPathLen) return _draftPath

  const path = new Path2D()
  path.moveTo(pts[0]![0], pts[0]![1])
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i]![0] + pts[i + 1]![0]) / 2
    const my = (pts[i]![1] + pts[i + 1]![1]) / 2
    path.quadraticCurveTo(pts[i]![0], pts[i]![1], mx, my)
  }
  path.lineTo(pts[pts.length - 1]![0], pts[pts.length - 1]![1])
  _draftPath = path
  _draftPathLen = pts.length
  return path
}

/** Renders the in-progress (uncommitted) draft shape. */
export function renderDraft(ctx: CanvasRenderingContext2D, draft: DraftShape): void {
  const { strokeColor, fillColor, strokeWidth } = useUiStore.getState()
  const { type, startX, startY, currentX, currentY } = draft

  ctx.save()
  ctx.strokeStyle = strokeColor
  ctx.fillStyle = fillColor
  ctx.lineWidth = strokeWidth
  ctx.setLineDash([6, 3])
  ctx.globalAlpha = 0.7

  switch (type) {
    case 'rect': {
      const x = Math.min(startX, currentX)
      const y = Math.min(startY, currentY)
      const w = Math.abs(currentX - startX)
      const h = Math.abs(currentY - startY)
      ctx.fillRect(x, y, w, h)
      ctx.strokeRect(x, y, w, h)
      break
    }
    case 'ellipse': {
      const cx = (startX + currentX) / 2
      const cy = (startY + currentY) / 2
      const rx = Math.abs(currentX - startX) / 2
      const ry = Math.abs(currentY - startY) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      break
    }
    case 'arrow': {
      const angle = Math.atan2(currentY - startY, currentX - startX)
      const headLen = Math.max(12, strokeWidth * 4)
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(currentX, currentY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(currentX, currentY)
      ctx.lineTo(
        currentX - headLen * Math.cos(angle - Math.PI / 6),
        currentY - headLen * Math.sin(angle - Math.PI / 6),
      )
      ctx.moveTo(currentX, currentY)
      ctx.lineTo(
        currentX - headLen * Math.cos(angle + Math.PI / 6),
        currentY - headLen * Math.sin(angle + Math.PI / 6),
      )
      ctx.stroke()
      break
    }

    case 'freehand': {
      const pts = draft.rawPoints
      if (!pts || pts.length < 2) break
      ctx.setLineDash([])
      ctx.globalAlpha = 0.85
      ctx.stroke(getFreehandDraftPath(pts))
      break
    }

    // Text tool has no drag-draft; overlay handles it
    case 'text':
      break
  }
  ctx.restore()
}
