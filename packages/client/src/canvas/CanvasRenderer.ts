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
import { usePresenceStore } from '../store/presenceStore.js'
import { useSelectionStore } from '../features/selection/selectionStore.js'
import { getBoundingBox } from '../lib/boundingBox.js'
import type { DraftShape } from '../features/drawing/DrawingHandler.js'
import type { Shape } from '@canvas-draw/shared'
// snapIndicator is a mutable export updated by SelectionHandler during arrow endpoint drags
import { snapIndicator } from '../features/selection/SelectionHandler.js'

// ---------------------------------------------------------------------------
// Remote lerp state — module-level, never goes in Zustand
// ---------------------------------------------------------------------------

const _remotePos = new Map<string, { x: number; y: number }>()
const LERP = 0.25

// ---------------------------------------------------------------------------
// Remote cursor lerp state
// ---------------------------------------------------------------------------

const _cursorPos    = new Map<string, { x: number; y: number }>()
const _cursorTarget = new Map<string, { x: number; y: number }>()
const CURSOR_LERP = 0.3

/**
 * Called by awarenessHandler when a remote cursor position arrives.
 * First call snaps to position; subsequent calls lerp smoothly.
 */
export function markCursorUpdate(userId: string, wx: number, wy: number): void {
  _cursorTarget.set(userId, { x: wx, y: wy })
  if (!_cursorPos.has(userId)) {
    _cursorPos.set(userId, { x: wx, y: wy }) // snap on first appearance
  }
}

/** Called when a remote user disconnects. */
export function clearCursorPos(userId: string): void {
  _cursorPos.delete(userId)
  _cursorTarget.delete(userId)
}

/** Clear all cursor lerp state (called on reconnect). */
export function clearAllCursorPos(): void {
  _cursorPos.clear()
  _cursorTarget.clear()
}

// ---------------------------------------------------------------------------
// Dedicated cursor RAF loop
// Runs independently of shape-change redraws so remote cursors animate
// smoothly even when the canvas is otherwise idle.
// ---------------------------------------------------------------------------

let _cursorRafId: number | null = null

/**
 * Start a continuous RAF loop that calls requestRender() whenever at least
 * one remote user is present. Returns a cleanup function.
 *
 * Call once from App.tsx after the canvas engine is ready.
 */
export function startCursorLoop(requestRender: () => void): () => void {
  function tick() {
    if (Object.keys(usePresenceStore.getState().remoteUsers).length > 0) {
      requestRender()
    }
    _cursorRafId = requestAnimationFrame(tick)
  }
  if (_cursorRafId === null) {
    _cursorRafId = requestAnimationFrame(tick)
  }
  return () => {
    if (_cursorRafId !== null) {
      cancelAnimationFrame(_cursorRafId)
      _cursorRafId = null
    }
  }
}

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

  // Selection overlay rendered in screen-space
  const { selectedIds, rubberBand } = useSelectionStore.getState()
  const selectedShapes = [...selectedIds]
    .map((id) => shapes[id])
    .filter(Boolean) as Shape[]
  renderSelectionOverlay(ctx, selectedShapes, rubberBand, viewport)

  // Snap indicator — shown during arrow endpoint drag near a snap anchor
  if (snapIndicator) {
    const isx = snapIndicator.x * zoom + offsetX
    const isy = snapIndicator.y * zoom + offsetY
    ctx.beginPath()
    ctx.arc(isx, isy, 8, 0, Math.PI * 2)
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = 'rgba(99,102,241,0.15)'
    ctx.fill()
  }

  // Remote cursors rendered in screen-space
  renderRemoteCursors(ctx, zoom, offsetX, offsetY)
}

function renderRemoteCursors(
  ctx: CanvasRenderingContext2D,
  zoom: number,
  offsetX: number,
  offsetY: number,
): void {
  const { remoteUsers } = usePresenceStore.getState()

  ctx.save()
  ctx.font = '11px system-ui, sans-serif'

  for (const user of Object.values(remoteUsers)) {
    if (!user.cursor) continue

    // Seed lerp target from latest awareness position
    markCursorUpdate(user.userId, user.cursor.x, user.cursor.y)

    const target = _cursorTarget.get(user.userId)
    const pos = _cursorPos.get(user.userId)
    if (!target || !pos) continue

    // Advance lerp one step
    pos.x += (target.x - pos.x) * CURSOR_LERP
    pos.y += (target.y - pos.y) * CURSOR_LERP
    _cursorPos.set(user.userId, pos)

    const sx = pos.x * zoom + offsetX
    const sy = pos.y * zoom + offsetY

    // Cursor dot
    ctx.beginPath()
    ctx.arc(sx, sy, 5, 0, Math.PI * 2)
    ctx.fillStyle = user.color
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Colored name badge
    const label = user.name ?? user.userId.slice(0, 6)
    const labelW = ctx.measureText(label).width + 8
    ctx.fillStyle = user.color
    ctx.beginPath()
    ctx.roundRect(sx + 6, sy - 18, labelW, 16, 4)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillText(label, sx + 10, sy - 6)
  }

  ctx.restore()
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
