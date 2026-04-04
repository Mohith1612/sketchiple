/**
 * DrawingHandler — translates pointer events into shape commits.
 *
 * - pointerdown: start capturing; immediately commit a zero-size shape to Yjs so peers see it
 * - pointermove: update local draft (instant render) + throttled Yjs update (≥16ms) for live sync
 * - pointerup: write final dimensions; remove if too small (just a click)
 */
import type { Shape } from '@canvas-draw/shared'
import { addShape, createShape, updateShape, removeShape } from '../shapes/index.js'
import { snapToShape } from '../shapes/arrowBinding.js'
import { useUiStore } from '../../store/uiStore.js'
import { throttle, type ThrottledFn } from '../../lib/throttle.js'

export interface DraftShape {
  type: Shape['type']
  startX: number
  startY: number
  currentX: number
  currentY: number
  /** Freehand only — raw collected points before RDP simplification */
  rawPoints?: [number, number][]
}

type SetDraft = (draft: DraftShape | null) => void

export function createDrawingHandlers(
  canvas: HTMLCanvasElement,
  setDraft: SetDraft,
  requestRender: () => void,
) {
  let active = false
  let draft: DraftShape | null = null
  let activeDraftId: string | null = null
  let throttledDrawSync: ThrottledFn<[string, Parameters<typeof updateShape>[1]]> | null = null

  function getWorldPos(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    return useUiStore.getState().screenToWorld(sx, sy)
  }

  function onPointerDown(e: PointerEvent) {
    const tool = useUiStore.getState().activeTool
    if (tool === 'select' || tool === 'text' || tool === 'pan' || tool === 'freehand') return
    e.preventDefault()
    canvas.setPointerCapture(e.pointerId)

    const { x, y } = getWorldPos(e)
    active = true

    draft = { type: tool, startX: x, startY: y, currentX: x, currentY: y }

    // Immediately commit a zero-size placeholder to Yjs so remote peers see it appear right away
    const { strokeColor, fillColor, strokeWidth } = useUiStore.getState()
    const initialShape = createShape({
      type: tool,
      x,
      y,
      width: 0,
      height: 0,
      stroke: strokeColor,
      fill: tool === 'arrow' ? 'transparent' : fillColor,
      strokeWidth,
      ...(tool === 'arrow' ? { points: [[x, y], [x, y]] as [[number, number], [number, number]] } : {}),
    })
    activeDraftId = initialShape.id
    throttledDrawSync = throttle(
      (id: string, patch: Parameters<typeof updateShape>[1]) => updateShape(id, patch),
      32,
      { leading: true, trailing: true },
    )
    addShape(initialShape)
    setDraft(draft)
  }

  function onPointerMove(e: PointerEvent) {
    if (!active || !draft) return
    const { x, y } = getWorldPos(e)

    draft = { ...draft, currentX: x, currentY: y }
    setDraft(draft) // instant local render

    if (activeDraftId && throttledDrawSync) {
      const { startX, startY, currentX, currentY, type } = draft
      if (type === 'arrow') {
        throttledDrawSync(activeDraftId, {
          x: Math.min(startX, currentX),
          y: Math.min(startY, currentY),
          width: Math.abs(currentX - startX),
          height: Math.abs(currentY - startY),
          points: [[startX, startY], [currentX, currentY]],
        })
      } else {
        throttledDrawSync(activeDraftId, {
          x: Math.min(startX, currentX),
          y: Math.min(startY, currentY),
          width: Math.abs(currentX - startX),
          height: Math.abs(currentY - startY),
        })
      }
    }
    requestRender()
  }

  function onPointerUp() {
    if (!active || !draft) return
    active = false

    const { startX, startY, currentX, currentY, type } = draft
    const id = activeDraftId!
    activeDraftId = null
    throttledDrawSync?.flush()
    throttledDrawSync?.cancel()
    throttledDrawSync = null

    if (type === 'arrow') {
      const { viewport } = useUiStore.getState()
      const fromSnap = snapToShape(startX, startY, id, viewport.zoom, viewport.offsetX, viewport.offsetY)
      const toSnap = snapToShape(currentX, currentY, id, viewport.zoom, viewport.offsetX, viewport.offsetY)

      updateShape(id, {
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: Math.abs(currentX - startX),
        height: Math.abs(currentY - startY),
        points: [[startX, startY], [currentX, currentY]],
        ...(fromSnap ? { fromShapeId: fromSnap.shapeId, fromAnchor: fromSnap.anchor } : {}),
        ...(toSnap ? { toShapeId: toSnap.shapeId, toAnchor: toSnap.anchor } : {}),
      })
      setDraft(null)
      draft = null
      return
    }

    const width = Math.abs(currentX - startX)
    const height = Math.abs(currentY - startY)

    if (width < 2 && height < 2) {
      // Just a click — discard the placeholder shape
      removeShape(id)
      setDraft(null)
      draft = null
      return
    }

    // Commit final dimensions
    updateShape(id, {
      x: Math.min(startX, currentX),
      y: Math.min(startY, currentY),
      width,
      height,
    })

    setDraft(null)
    draft = null
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
