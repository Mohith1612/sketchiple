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
  shapesInRect,
  getResizeAnchor,
  type ResizeHandle,
} from './hitTest.js'
import { useSelectionStore } from './selectionStore.js'
import { useShapeStore } from '../../store/shapeStore.js'
import { useUiStore } from '../../store/uiStore.js'
import { updateShape, updateShapeLocal } from '../shapes/index.js'
import { resolveArrowEndpoints, snapToShape } from '../shapes/arrowBinding.js'
import { throttle, type ThrottledFn } from '../../lib/throttle.js'

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nw-resize',
  ne: 'ne-resize',
  sw: 'sw-resize',
  se: 'se-resize',
}


const MIN_SIZE = 10

// Snap radii for hysteresis: larger exit radius prevents flicker at boundary
const SNAP_RADIUS_IN  = 8   // px — engage snap on approach
const SNAP_RADIUS_OUT = 12  // px — release snap only when pointer moves farther

// ---------------------------------------------------------------------------
// Snap indicator — exported so CanvasRenderer can draw it (Layer 5)
// ---------------------------------------------------------------------------
export interface SnapIndicator {
  /** World-space snap position */
  x: number
  y: number
}

/** Current snap indicator. CanvasRenderer reads this each frame. */
export let snapIndicator: SnapIndicator | null = null

interface ArrowEndpointState {
  shapeId: string
  endpoint: 'from' | 'to'
  /** Snap candidate from previous move (for hysteresis) */
  lastSnap: ReturnType<typeof snapToShape>
  throttledYjs: ThrottledFn<[string, Partial<Shape>]>
}

interface ResizeState {
  handle: ResizeHandle
  shapeId: string
  ax: number
  ay: number
  origW: number
  origH: number
  throttledYjs: ThrottledFn<[string, Partial<Shape>]>
}

interface ResizeGroupState {
  handle: ResizeHandle
  ax: number
  ay: number
  initialGroupBBox: { x: number; y: number; width: number; height: number }
  initialShapes: Map<string, { x: number; y: number; width: number; height: number }>
  throttledYjs: ThrottledFn<[[string, Partial<Shape>][]]>
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
  | { type: 'move';           state: MoveState }
  | { type: 'resize';         state: ResizeState }
  | { type: 'resize-group';   state: ResizeGroupState }
  | { type: 'arrow-endpoint'; state: ArrowEndpointState }
  | { type: 'rubber-band';    startWx: number; startWy: number }

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

    // --- Priority 1a: group resize handles (≥2 resizable shapes selected) ---
    if (selectedIds.size >= 2) {
      const groupBBox = computeGroupBBox(selectedIds, shapes)
      if (groupBBox) {
        const handle = hitTestGroupHandle(groupBBox, sx, sy, vp)
        if (handle) {
          canvas.setPointerCapture(e.pointerId)
          const ax = handle === 'nw' || handle === 'sw' ? groupBBox.x + groupBBox.width : groupBBox.x
          const ay = handle === 'nw' || handle === 'ne' ? groupBBox.y + groupBBox.height : groupBBox.y
          const initialShapes = new Map<string, { x: number; y: number; width: number; height: number }>()
          for (const id of selectedIds) {
            const s = shapes[id]
            if (!s || s.type === 'arrow' || s.type === 'text' || s.type === 'freehand') continue
            initialShapes.set(id, { x: s.x, y: s.y, width: s.width, height: s.height })
          }
          interaction = {
            type: 'resize-group',
            state: {
              handle, ax, ay,
              initialGroupBBox: groupBBox,
              initialShapes,
              throttledYjs: throttle(
                (patches: [string, Partial<Shape>][]) => {
                  for (const [id, patch] of patches) updateShape(id, patch)
                },
                32,
                { leading: true, trailing: true },
              ),
            },
          }
          setCursor(HANDLE_CURSORS[handle])
          return
        }
      }
    }

    // --- Priority 1b: resize handles on selected resizable shapes ---
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

    // --- Priority 2: arrow endpoints on selected arrows ---
    for (const id of selectedIds) {
      const shape = shapes[id]
      if (!shape || shape.type !== 'arrow') continue
      const endpoint = hitTestArrowEndpoint(shape, sx, sy, vp)
      if (endpoint) {
        canvas.setPointerCapture(e.pointerId)
        interaction = {
          type: 'arrow-endpoint',
          state: {
            shapeId: id,
            endpoint,
            lastSnap: null,
            throttledYjs: throttle(
              (sid: string, patch: Partial<Shape>) => updateShape(sid, patch),
              32,
              { leading: true, trailing: true },
            ),
          },
        }
        setCursor('crosshair')
        return
      }
    }

    // --- Priority 3: shape body hit ---
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

    // --- Priority 4: canvas → rubber-band ---
    if (!e.shiftKey) useSelectionStore.getState().deselectAll()
    const { x: startWx, y: startWy } = screenToWorld(sx, sy)
    useSelectionStore.getState().setRubberBand({ startX: startWx, startY: startWy, endX: startWx, endY: startWy })
    canvas.setPointerCapture(e.pointerId)
    interaction = { type: 'rubber-band', startWx, startWy }
    requestRender()
  }

  function onPointerMove(e: PointerEvent) {
    if (useUiStore.getState().activeTool !== 'select') return
    const { sx, sy } = getScreenPos(e)
    const { screenToWorld, viewport: vp } = useUiStore.getState()

    // --- Resize drag ---
    if (interaction.type === 'resize') {
      const { handle, shapeId, ax, ay, origW, origH, throttledYjs } = interaction.state
      const { x: wx, y: wy } = screenToWorld(sx, sy)
      const patch = applyResize(handle, ax, ay, origW, origH, wx, wy, e.shiftKey)
      updateShapeLocal(shapeId, patch)
      throttledYjs(shapeId, patch)
      requestRender()
      return
    }

    // --- Group resize drag ---
    if (interaction.type === 'resize-group') {
      const { handle, ax, ay, initialGroupBBox, initialShapes, throttledYjs } = interaction.state
      const { x: wx, y: wy } = screenToWorld(sx, sy)
      const groupPatch = applyResize(handle, ax, ay, initialGroupBBox.width, initialGroupBBox.height, wx, wy, e.shiftKey)
      const patches: [string, Partial<Shape>][] = []
      if (initialGroupBBox.width > 0 && initialGroupBBox.height > 0) {
        for (const [id, orig] of initialShapes) {
          const patch: Partial<Shape> = {
            x:      groupPatch.x! + ((orig.x - initialGroupBBox.x) / initialGroupBBox.width)  * (groupPatch.width  as number),
            y:      groupPatch.y! + ((orig.y - initialGroupBBox.y) / initialGroupBBox.height) * (groupPatch.height as number),
            width:  Math.max(MIN_SIZE, (orig.width  / initialGroupBBox.width)  * (groupPatch.width  as number)),
            height: Math.max(MIN_SIZE, (orig.height / initialGroupBBox.height) * (groupPatch.height as number)),
          }
          updateShapeLocal(id, patch)
          patches.push([id, patch])
        }
      }
      throttledYjs(patches)
      requestRender()
      return
    }

    // --- Move drag ---
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

    // --- Arrow endpoint drag ---
    if (interaction.type === 'arrow-endpoint') {
      const st = interaction.state
      const { x: wx, y: wy } = screenToWorld(sx, sy)
      const { shapes } = useShapeStore.getState()
      const arrow = shapes[st.shapeId]
      if (!arrow) return

      const [p0, p1] = resolveArrowEndpoints(arrow)
      const newPoints: [[number, number], [number, number]] = st.endpoint === 'from'
        ? [[wx, wy], p1]
        : [p0, [wx, wy]]

      // Instant local render — visually detach from bound shape while dragging
      const localPatch: Partial<Shape> = { points: newPoints }
      if (st.endpoint === 'from') Object.assign(localPatch, { fromShapeId: undefined, fromAnchor: undefined })
      else Object.assign(localPatch, { toShapeId: undefined, toAnchor: undefined })
      updateShapeLocal(st.shapeId, localPatch)

      // Throttled Yjs sync so remote peers see smooth drag
      st.throttledYjs(st.shapeId, { points: newPoints })

      // Snap with hysteresis
      const candidate = e.altKey
        ? null
        : snapToShape(wx, wy, st.shapeId, vp.zoom, vp.offsetX, vp.offsetY,
            st.lastSnap ? SNAP_RADIUS_OUT : SNAP_RADIUS_IN)
      st.lastSnap = candidate
      snapIndicator = candidate ? { x: candidate.x, y: candidate.y } : null

      requestRender()
      return
    }

    // --- Rubber-band ---
    if (interaction.type === 'rubber-band') {
      const { rubberBand } = useSelectionStore.getState()
      if (rubberBand) {
        const { x: endX, y: endY } = screenToWorld(sx, sy)
        useSelectionStore.getState().setRubberBand({ ...rubberBand, endX, endY })
        requestRender()
      }
      return
    }

    // --- Idle: hover cursor feedback ---
    const { shapes } = useShapeStore.getState()
    const { selectedIds } = useSelectionStore.getState()
    const { x: wx, y: wy } = screenToWorld(sx, sy)

    // Check group resize handles (multi-select)
    if (selectedIds.size >= 2) {
      const groupBBox = computeGroupBBox(selectedIds, shapes)
      if (groupBBox) {
        const handle = hitTestGroupHandle(groupBBox, sx, sy, vp)
        if (handle) {
          setCursor(HANDLE_CURSORS[handle])
          useUiStore.getState().setHoveredId(null)
          return
        }
      }
    }

    // Check resize handles
    for (const id of selectedIds) {
      const shape = shapes[id]
      if (!shape || shape.type === 'arrow' || shape.type === 'text' || shape.type === 'freehand') continue
      const handle = hitTestHandle(shape, sx, sy, vp)
      if (handle) {
        setCursor(HANDLE_CURSORS[handle])
        useUiStore.getState().setHoveredId(null)
        return
      }
    }

    // Check arrow endpoints
    for (const id of selectedIds) {
      const shape = shapes[id]
      if (!shape || shape.type !== 'arrow') continue
      if (hitTestArrowEndpoint(shape, sx, sy, vp)) {
        setCursor('crosshair')
        useUiStore.getState().setHoveredId(null)
        return
      }
    }

    // Check shape body
    const hit = hitTestShapes(shapes, wx, wy)
    useUiStore.getState().setHoveredId(hit?.id ?? null)
    setCursor(hit ? 'move' : 'default')
  }

  function onPointerUp(e: PointerEvent) {
    if (useUiStore.getState().activeTool !== 'select') return

    const { sx, sy } = getScreenPos(e)
    const { screenToWorld } = useUiStore.getState()

    if (interaction.type === 'rubber-band') {
      const { rubberBand } = useSelectionStore.getState()
      if (rubberBand) {
        const { x: endX, y: endY } = screenToWorld(sx, sy)
        const rw = endX - rubberBand.startX
        const rh = endY - rubberBand.startY
        const { shapes } = useShapeStore.getState()
        const hits = shapesInRect(shapes, rubberBand.startX, rubberBand.startY, rw, rh)
        useSelectionStore.getState().selectMany(hits.map((s) => s.id))
        useSelectionStore.getState().setRubberBand(null)
      }
    }

    if (interaction.type === 'resize-group') {
      const { handle, ax, ay, initialGroupBBox, initialShapes, throttledYjs } = interaction.state
      const { x: wx, y: wy } = screenToWorld(sx, sy)
      const groupPatch = applyResize(handle, ax, ay, initialGroupBBox.width, initialGroupBBox.height, wx, wy, e.shiftKey)
      throttledYjs.flush()
      throttledYjs.cancel()
      if (initialGroupBBox.width > 0 && initialGroupBBox.height > 0) {
        for (const [id, orig] of initialShapes) {
          updateShape(id, {
            x:      groupPatch.x! + ((orig.x - initialGroupBBox.x) / initialGroupBBox.width)  * (groupPatch.width  as number),
            y:      groupPatch.y! + ((orig.y - initialGroupBBox.y) / initialGroupBBox.height) * (groupPatch.height as number),
            width:  Math.max(MIN_SIZE, (orig.width  / initialGroupBBox.width)  * (groupPatch.width  as number)),
            height: Math.max(MIN_SIZE, (orig.height / initialGroupBBox.height) * (groupPatch.height as number)),
          })
        }
      }
    }

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

    if (interaction.type === 'arrow-endpoint') {
      const st = interaction.state
      const { x: wx, y: wy } = screenToWorld(sx, sy)
      const { viewport: vp } = useUiStore.getState()
      const { shapes } = useShapeStore.getState()
      const arrow = shapes[st.shapeId]

      if (arrow) {
        const [p0, p1] = resolveArrowEndpoints(arrow)
        st.throttledYjs.flush()
        st.throttledYjs.cancel()

        const candidate = e.altKey
          ? null
          : snapToShape(wx, wy, st.shapeId, vp.zoom, vp.offsetX, vp.offsetY,
              st.lastSnap ? SNAP_RADIUS_OUT : SNAP_RADIUS_IN)

        if (candidate && !e.altKey) {
          const newPoints: [[number, number], [number, number]] = st.endpoint === 'from'
            ? [[wx, wy], p1]
            : [p0, [wx, wy]]
          const bindPatch: Partial<Shape> = st.endpoint === 'from'
            ? { fromShapeId: candidate.shapeId, fromAnchor: candidate.anchor, points: newPoints }
            : { toShapeId: candidate.shapeId, toAnchor: candidate.anchor, points: newPoints }
          updateShape(st.shapeId, bindPatch)
        } else {
          const newPoints: [[number, number], [number, number]] = st.endpoint === 'from'
            ? [[wx, wy], p1]
            : [p0, [wx, wy]]
          const detachPatch: Partial<Shape> = { points: newPoints }
          if (st.endpoint === 'from') Object.assign(detachPatch, { fromShapeId: undefined, fromAnchor: undefined })
          else Object.assign(detachPatch, { toShapeId: undefined, toAnchor: undefined })
          updateShape(st.shapeId, detachPatch)
        }
      }

      snapIndicator = null
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
// Group resize helpers
// ---------------------------------------------------------------------------

function computeGroupBBox(
  ids: Set<string>,
  shapes: Record<string, Shape>,
): { x: number; y: number; width: number; height: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let count = 0
  for (const id of ids) {
    const s = shapes[id]
    if (!s || s.type === 'arrow' || s.type === 'text' || s.type === 'freehand') continue
    minX = Math.min(minX, s.x);       minY = Math.min(minY, s.y)
    maxX = Math.max(maxX, s.x + s.width); maxY = Math.max(maxY, s.y + s.height)
    count++
  }
  if (count < 2 || !isFinite(minX)) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function hitTestGroupHandle(
  bbox: { x: number; y: number; width: number; height: number },
  sx: number,
  sy: number,
  vp: { zoom: number; offsetX: number; offsetY: number },
): ResizeHandle | null {
  const { zoom, offsetX, offsetY } = vp
  const corners: [ResizeHandle, number, number][] = [
    ['nw', bbox.x,              bbox.y              ],
    ['ne', bbox.x + bbox.width, bbox.y              ],
    ['sw', bbox.x,              bbox.y + bbox.height ],
    ['se', bbox.x + bbox.width, bbox.y + bbox.height ],
  ]
  for (const [handle, wx, wy] of corners) {
    const hsx = wx * zoom + offsetX
    const hsy = wy * zoom + offsetY
    if (Math.abs(sx - hsx) <= 6 && Math.abs(sy - hsy) <= 6) return handle
  }
  return null
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

// ---------------------------------------------------------------------------
// Arrow endpoint hit testing (screen-space)
// ---------------------------------------------------------------------------

function hitTestArrowEndpoint(
  arrow: Shape,
  sx: number,
  sy: number,
  vp: { zoom: number; offsetX: number; offsetY: number },
): 'from' | 'to' | null {
  const [p0, p1] = resolveArrowEndpoints(arrow)
  const RADIUS = 12
  const s0x = p0[0] * vp.zoom + vp.offsetX
  const s0y = p0[1] * vp.zoom + vp.offsetY
  const s1x = p1[0] * vp.zoom + vp.offsetX
  const s1y = p1[1] * vp.zoom + vp.offsetY
  if (Math.hypot(sx - s0x, sy - s0y) <= RADIUS) return 'from'
  if (Math.hypot(sx - s1x, sy - s1y) <= RADIUS) return 'to'
  return null
}
