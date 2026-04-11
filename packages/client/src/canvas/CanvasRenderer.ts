/**
 * CanvasRenderer — orchestrates the full scene render each RAF frame.
 * Renders: background → shapes → draft → selection overlay → remote cursors
 *
 * Remote smoothing: lerp interpolation (factor 0.25) is applied to shapes
 * that are being moved by remote peers, eliminating discrete-update jitter.
 * Local shapes always render at exact position.
 */
import { renderShape, invalidateFreehandPath } from '../features/shapes/ShapeRenderer.js'
import { renderDraft } from '../features/drawing/DraftRenderer.js'
import { renderSelectionOverlay } from '../features/selection/SelectionRenderer.js'
import { useShapeStore } from '../store/shapeStore.js'
import { useUiStore } from '../store/uiStore.js'
import { useSelectionStore } from '../features/selection/selectionStore.js'
import { getBoundingBox } from '../lib/boundingBox.js'
import type { DraftShape } from '../features/drawing/DrawingHandler.js'
import type { Shape } from '@canvas-draw/shared'

// ---------------------------------------------------------------------------
// Remote lerp state — module-level, never goes in Zustand
// ---------------------------------------------------------------------------

const _remotePos = new Map<string, { x: number; y: number }>()
const LERP = 0.25

/** Called by shapeStore observer when a remote delete happens. */
export function clearRemoteLerpPos(id: string): void {
  _remotePos.delete(id)
  invalidateFreehandPath(id)
}

/** Mark a shape as being updated remotely so lerp kicks in next frame. */
export function markRemoteUpdate(id: string, x: number, y: number): void {
  if (_remotePos.has(id)) {
    _remotePos.set(id, { x, y })
  } else {
    // First remote update: seed with target so first frame snaps
    _remotePos.set(id, { x, y })
  }
}

function lerpRemoteShape(shape: Shape): Shape {
  const target = _remotePos.get(shape.id)
  if (!target) return shape
  const cur = target
  const lx = cur.x + (shape.x - cur.x) * LERP
  const ly = cur.y + (shape.y - cur.y) * LERP
  _remotePos.set(shape.id, { x: lx, y: ly })
  return { ...shape, x: lx, y: ly }
}

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

  // Render committed shapes — cull those outside viewport, lerp remote shapes
  const canvasW = ctx.canvas.clientWidth
  const canvasH = ctx.canvas.clientHeight
  for (const shape of Object.values(shapes)) {
    if (!isShapeVisible(shape, zoom, offsetX, offsetY, canvasW, canvasH)) continue
    const s = _remotePos.has(shape.id) ? lerpRemoteShape(shape) : shape
    renderShape(ctx, s)
  }

  // Render in-progress draft
  if (draft) {
    renderDraft(ctx, draft)
  }

  ctx.restore()

  // Selection overlay + rubber-band (screen-space, after ctx.restore())
  const { selectedIds, rubberBand } = useSelectionStore.getState()
  const selectedShapes = [...selectedIds].map((id) => shapes[id]).filter(Boolean) as Shape[]
  renderSelectionOverlay(ctx, selectedShapes, rubberBand, viewport)
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
