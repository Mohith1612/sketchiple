/**
 * SelectionHandler — pointer events for the 'select' tool.
 *
 * Interaction state machine: a single discriminated union prevents impossible
 * states (e.g. resize + move active simultaneously) and makes transitions explicit.
 *
 * Priority order for pointerdown:
 *   1. Resize handles (selected rect/ellipse corners)
 *   2. Arrow endpoints (selected arrows)
 *   3. Shape body hit → move / (shift-)select
 *   4. Canvas → rubber-band
 *
 * Features:
 *   - Shift+drag → axis-constrained move
 *   - Shift+resize → aspect-ratio lock
 *   - Arrow endpoint drag → live rebind/detach with snap hysteresis
 *   - Hover cursor feedback (resize cursors, move, crosshair for arrow endpoints)
 */
import type { Shape } from '@canvas-draw/shared'
import {
  hitTestShapes,
  type ResizeHandle,
} from './hitTest.js'
import { useSelectionStore } from './selectionStore.js'
import { useShapeStore } from '../../store/shapeStore.js'
import { useUiStore } from '../../store/uiStore.js'

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nw-resize',
  ne: 'ne-resize',
  sw: 'sw-resize',
  se: 'se-resize',
}

// Suppress unused warning — used in later commits
void HANDLE_CURSORS

type Interaction =
  | { type: 'idle' }

export function createSelectionHandlers(
  canvas: HTMLCanvasElement,
  requestRender: () => void,
): () => void {
  let interaction: Interaction = { type: 'idle' }

  function getScreenPos(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top }
  }

  function setCursor(c: string) {
    useUiStore.getState().setCursor(c)
    canvas.style.cursor = c
  }

  function onPointerDown(e: PointerEvent) {
    if (useUiStore.getState().activeTool !== 'select') return
    e.preventDefault()

    const { sx, sy } = getScreenPos(e)
    const { screenToWorld } = useUiStore.getState()
    const { x: wx, y: wy } = screenToWorld(sx, sy)
    const { shapes } = useShapeStore.getState()
    const { selectedIds } = useSelectionStore.getState()

    // Shape body hit
    const hit = hitTestShapes(shapes, wx, wy)
    if (hit) {
      if (e.shiftKey) {
        useSelectionStore.getState().toggleSelection(hit.id)
      } else if (!selectedIds.has(hit.id)) {
        useSelectionStore.getState().selectOne(hit.id)
      }
      canvas.setPointerCapture(e.pointerId)
      setCursor('move')
      requestRender()
      return
    }

    // Canvas → deselect
    if (!e.shiftKey) useSelectionStore.getState().deselectAll()
    canvas.setPointerCapture(e.pointerId)
    requestRender()
  }

  function onPointerMove(e: PointerEvent) {
    if (useUiStore.getState().activeTool !== 'select') return
    const { sx, sy } = getScreenPos(e)
    const { screenToWorld } = useUiStore.getState()
    const { x: wx, y: wy } = screenToWorld(sx, sy)
    const { shapes } = useShapeStore.getState()
    void interaction

    // Idle hover feedback
    const hit = hitTestShapes(shapes, wx, wy)
    useUiStore.getState().setHoveredId(hit?.id ?? null)
    setCursor(hit ? 'move' : 'default')
  }

  function onPointerUp(_e: PointerEvent) {
    if (useUiStore.getState().activeTool !== 'select') return
    interaction = { type: 'idle' }
    setCursor('default')
    requestRender()
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
  }
}
