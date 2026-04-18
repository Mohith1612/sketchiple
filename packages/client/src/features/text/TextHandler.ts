import type { Shape } from '@canvas-draw/shared'
import { addShape } from '../shapes/index.js'
import { hitTestShapes } from '../selection/hitTest.js'
import { useShapeStore } from '../../store/shapeStore.js'
import { useUiStore } from '../../store/uiStore.js'
import { newId } from '../../lib/uuid.js'

export interface TextEditingState {
  shapeId: string
  isNew: boolean
}

type SetEditing = (state: TextEditingState | null) => void

export function createTextHandlers(
  canvas: HTMLCanvasElement,
  setEditing: SetEditing,
): () => void {
  function onPointerDown(e: PointerEvent): void {
    if (useUiStore.getState().activeTool !== 'text') return
    e.preventDefault()

    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const { x: wx, y: wy } = useUiStore.getState().screenToWorld(sx, sy)
    const { shapes } = useShapeStore.getState()
    const hit = hitTestShapes(shapes, wx, wy)

    if (hit?.type === 'text') {
      setEditing({ shapeId: hit.id, isNew: false })
      return
    }

    // Create a new text placeholder and immediately open the editor
    const { strokeColor, strokeWidth } = useUiStore.getState()
    const shape: Shape = {
      id: newId(),
      type: 'text',
      x: wx,
      y: wy,
      width: 200,
      height: 40,
      content: '',
      fontSize: 16,
      fontFamily: 'system-ui, sans-serif',
      fontWeight: 'normal',
      textAlign: 'left',
      stroke: strokeColor,
      fill: 'transparent',
      strokeWidth,
      opacity: 1,
    }
    addShape(shape)
    setEditing({ shapeId: shape.id, isNew: true })
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  return () => canvas.removeEventListener('pointerdown', onPointerDown)
}
