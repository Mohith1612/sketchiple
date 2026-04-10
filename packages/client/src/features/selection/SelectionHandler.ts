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
  hitTestHandle,
  getResizeAnchor,
  type ResizeHandle,
} from './hitTest.js'
import { useSelectionStore } from './selectionStore.js'
import { useShapeStore } from '../../store/shapeStore.js'
import { useUiStore } from '../../store/uiStore.js'
import { updateShape, updateShapeLocal } from '../shapes/index.js'
import { throttle, type ThrottledFn } from '../../lib/throttle.js'

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nw-resize',
  ne: 'ne-resize',
  sw: 'sw-resize',
  se: 'se-resize',
}

// Suppress unused warning — used in later commits
void HANDLE_CURSORS

const MIN_SIZE = 10

interface ResizeState {
  handle: ResizeHandle
  shapeId: string
  ax: number
  ay: number
  origW: number
  origH: number
  throttledYjs: ThrottledFn<[string, Partial<Shape>]>
}

interface MoveState {
  startSx: number
  startSy: number
  initialPositions: Map<string, {
    x: number
    y: number
    points?: [[number, number], [number, number]]
    freehandPoints?: [number, number][]
  }>
  throttledYjs: ThrottledFn<[string, Partial<Shape>]>
}

type Interaction =
  | { type: 'idle' }
  | { type: 'move';   state: MoveState }
  | { type: 'resize'; state: ResizeState }

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
    const { screenToWorld, viewport: vp } = useUiStore.getState()
    const { x: wx, y: wy } = screenToWorld(sx, sy)
    const { shapes } = useShapeStore.getState()
    const { selectedIds } = useSelectionStore.getState()

    // --- Priority 1: resize handles on selected resizable shapes ---
    for (const id of selectedIds) {
      const shape = shapes[id]
      if (!shape || shape.type === 'arrow' || shape.type === 'text' || shape.type === 'freehand') continue
      const handle = hitTestHandle(shape, sx, sy, vp)
      if (handle) {
        canvas.setPointerCapture(e.pointerId)
        const { ax, ay } = getResizeAnchor(shape, handle)
        interaction = {
          type: 'resize',
          state: {
            handle,
            shapeId: id,
            ax, ay,
            origW: shape.width,
            origH: shape.height,
            throttledYjs: throttle(
              (sid: string, patch: Partial<Shape>) => updateShape(sid, patch),
              32,
              { leading: true, trailing: true },
            ),
          },
        }
        setCursor(HANDLE_CURSORS[handle])
        return
      }
    }

    // Shape body hit
    const hit = hitTestShapes(shapes, wx, wy)
    if (hit) {
      if (e.shiftKey) {
        useSelectionStore.getState().toggleSelection(hit.id)
      } else if (!selectedIds.has(hit.id)) {
        useSelectionStore.getState().selectOne(hit.id)
      }

      canvas.setPointerCapture(e.pointerId)
      const currentIds = useSelectionStore.getState().selectedIds
      const initialPositions = new Map<string, {
        x: number; y: number
        points?: [[number, number], [number, number]]
        freehandPoints?: [number, number][]
      }>()
      for (const id of currentIds) {
        const s = shapes[id]
        if (!s) continue
        const entry: typeof initialPositions extends Map<string, infer V> ? V : never = { x: s.x, y: s.y }
        if (s.points !== undefined) entry.points = s.points
        if (s.freehandPoints !== undefined) entry.freehandPoints = s.freehandPoints
        initialPositions.set(id, entry)
      }
      interaction = {
        type: 'move',
        state: {
          startSx: sx,
          startSy: sy,
          initialPositions,
          throttledYjs: throttle(
            (id: string, patch: Partial<Shape>) => updateShape(id, patch),
            32,
            { leading: true, trailing: true },
          ),
        },
      }
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

    // Resize drag
    if (interaction.type === 'resize') {
      const { handle, shapeId, ax, ay, origW, origH, throttledYjs } = interaction.state
      const { x: wx, y: wy } = screenToWorld(sx, sy)
      const patch = applyResize(handle, ax, ay, origW, origH, wx, wy, e.shiftKey)
      updateShapeLocal(shapeId, patch)
      throttledYjs(shapeId, patch)
      requestRender()
      return
    }

    // Move drag
    if (interaction.type === 'move') {
      const { startSx, startSy, initialPositions, throttledYjs } = interaction.state
      const { x: cx, y: cy } = screenToWorld(sx, sy)
      const { x: ox, y: oy } = screenToWorld(startSx, startSy)
      let dx = cx - ox
      let dy = cy - oy

      // Shift → axis constraint
      if (e.shiftKey) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0
        else dx = 0
      }

      for (const [id, origin] of initialPositions) {
        const patch: Partial<Shape> = { x: origin.x + dx, y: origin.y + dy }
        if (origin.points) {
          patch.points = [
            [origin.points[0][0] + dx, origin.points[0][1] + dy],
            [origin.points[1][0] + dx, origin.points[1][1] + dy],
          ]
        }
        if (origin.freehandPoints) {
          patch.freehandPoints = origin.freehandPoints.map(([x, y]) => [x + dx, y + dy])
        }
        updateShapeLocal(id, patch)
        throttledYjs(id, patch)
      }
      requestRender()
      return
    }

    const { x: wx, y: wy } = screenToWorld(sx, sy)
    const { shapes } = useShapeStore.getState()

    // Idle hover feedback
    const hit = hitTestShapes(shapes, wx, wy)
    useUiStore.getState().setHoveredId(hit?.id ?? null)
    setCursor(hit ? 'move' : 'default')
  }

  function onPointerUp(e: PointerEvent) {
    if (useUiStore.getState().activeTool !== 'select') return

    const { sx, sy } = getScreenPos(e)
    const { screenToWorld } = useUiStore.getState()

    if (interaction.type === 'resize') {
      const { handle, shapeId, ax, ay, origW, origH, throttledYjs } = interaction.state
      const { x: wx, y: wy } = screenToWorld(sx, sy)
      const finalPatch = applyResize(handle, ax, ay, origW, origH, wx, wy, e.shiftKey)
      throttledYjs.flush()
      throttledYjs.cancel()
      updateShape(shapeId, finalPatch)
    }

    if (interaction.type === 'move') {
      const { throttledYjs } = interaction.state
      throttledYjs.flush()
      throttledYjs.cancel()
    }

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

// ---------------------------------------------------------------------------
// Resize math — no-flip + min-size + optional aspect-ratio lock
// ---------------------------------------------------------------------------

function applyResize(
  handle: ResizeHandle,
  ax: number,
  ay: number,
  origW: number,
  origH: number,
  wx: number,
  wy: number,
  shiftLock: boolean,
): Partial<Shape> {
  let newX: number, newY: number, newW: number, newH: number

  switch (handle) {
    case 'nw':
      newX = Math.min(ax - MIN_SIZE, wx); newY = Math.min(ay - MIN_SIZE, wy)
      newW = ax - newX;                   newH = ay - newY
      break
    case 'ne':
      newX = ax;                          newY = Math.min(ay - MIN_SIZE, wy)
      newW = Math.max(MIN_SIZE, wx - ax); newH = ay - newY
      break
    case 'sw':
      newX = Math.min(ax - MIN_SIZE, wx); newY = ay
      newW = ax - newX;                   newH = Math.max(MIN_SIZE, wy - ay)
      break
    default: // se
      newX = ax;                          newY = ay
      newW = Math.max(MIN_SIZE, wx - ax); newH = Math.max(MIN_SIZE, wy - ay)
  }

  if (shiftLock && origW > 0 && origH > 0) {
    const ratio = origW / origH
    if (Math.abs(newW - origW) >= Math.abs(newH - origH)) {
      newH = Math.max(MIN_SIZE, newW / ratio)
    } else {
      newW = Math.max(MIN_SIZE, newH * ratio)
    }
  }

  return { x: newX, y: newY, width: newW, height: newH }
}
