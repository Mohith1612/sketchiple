import { useEffect, useRef, useState } from 'react'
import { CanvasEngine } from './canvas/CanvasEngine.js'
import { renderScene } from './canvas/CanvasRenderer.js'
import { createDrawingHandlers } from './features/drawing/index.js'
import type { DraftShape } from './features/drawing/index.js'
import { createSelectionHandlers } from './features/selection/SelectionHandler.js'
import { useSelectionStore } from './features/selection/selectionStore.js'
import { useUiStore, type Tool } from './store/uiStore.js'
import { removeShape, groupSelected, ungroupSelected, alignSelected } from './features/shapes/index.js'
import { useShapeStore } from './store/shapeStore.js'
import { ydoc, getShapesMap } from './crdt/doc.js'
import type { Shape } from '@canvas-draw/shared'
import { wsProvider } from './crdt/sync.js'
import { newId } from './lib/uuid.js'
import { undoManager } from './crdt/undoManager.js'

function getRoomId(): string {
  const hash = window.location.hash.slice(1)
  if (hash) return hash
  const id = newId()
  window.location.hash = id
  return id
}

// Attach wheel handler to canvas for zoom and pan

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'select', label: '↖ Select' },
  { id: 'rect', label: '▭ Rect' },
  { id: 'ellipse', label: '◯ Ellipse' },
  { id: 'arrow', label: '→ Arrow' },
  { id: 'text', label: 'T Text' },
  { id: 'freehand', label: '✏ Pen' },
  { id: 'pan', label: '✋ Pan' },
]

const btnBase: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 13,
  background: '#f1f5f9',
  color: '#334155',
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<CanvasEngine | null>(null)
  const [draft, setDraft] = useState<DraftShape | null>(null)
  const draftRef = useRef<DraftShape | null>(null)
  const activeTool = useUiStore((s) => s.activeTool)
  const setTool = useUiStore((s) => s.setTool)

  draftRef.current = draft

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new CanvasEngine(canvas)
    engineRef.current = engine

    engine.setRenderCallback((ctx) => {
      renderScene(ctx, draftRef.current)
    })

    const cleanupDrawing = createDrawingHandlers(
      canvas,
      (d) => setDraft(d),
      () => engine.requestRender(),
    )

    const cleanupSelection = createSelectionHandlers(canvas, () => engine.requestRender())

    const roomId = getRoomId()
    wsProvider.connect(roomId)

    engine.requestRender()

    return () => {
      cleanupDrawing()
      cleanupSelection()
      engine.destroy()
    }
  }, [])

  // Re-render whenever store state changes
  useEffect(() => {
    engineRef.current?.requestRender()
  })

  // Undo / Redo / Group / Alignment keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return

      if (meta && e.key.toLowerCase() === 'g' && !e.shiftKey) {
        e.preventDefault()
        groupSelected([...useSelectionStore.getState().selectedIds])
        return
      }
      if (meta && e.key.toLowerCase() === 'g' && e.shiftKey) {
        e.preventDefault()
        ungroupSelected([...useSelectionStore.getState().selectedIds])
        return
      }

      if (meta && e.shiftKey && ['l', 'e', 'r', 't', 'm', 'b'].includes(e.key.toLowerCase())) {
        e.preventDefault()
        const ids = [...useSelectionStore.getState().selectedIds]
        const key = e.key.toLowerCase()
        if (key === 'l') alignSelected(ids, 'left')
        if (key === 'e') alignSelected(ids, 'hcenter')
        if (key === 'r') alignSelected(ids, 'right')
        if (key === 't') alignSelected(ids, 'top')
        if (key === 'm') alignSelected(ids, 'vcenter')
        if (key === 'b') alignSelected(ids, 'bottom')
        return
      }

      // Arrow key nudging — 1px normal, 10px with Shift
      const NUDGE_DELTAS: Record<string, [number, number]> = {
        ArrowLeft:  [-1, 0],
        ArrowRight: [1,  0],
        ArrowUp:    [0, -1],
        ArrowDown:  [0,  1],
      }
      if (e.code in NUDGE_DELTAS && !meta) {
        const { selectedIds } = useSelectionStore.getState()
        if (selectedIds.size > 0) {
          e.preventDefault()
          const factor = e.shiftKey ? 10 : 1
          const [baseDx, baseDy] = NUDGE_DELTAS[e.code]!
          const dx = baseDx * factor
          const dy = baseDy * factor
          const { shapes } = useShapeStore.getState()
          ydoc.transact(() => {
            for (const id of selectedIds) {
              const s = shapes[id]
              if (!s) continue
              const patch: Partial<Shape> = { x: s.x + dx, y: s.y + dy }
              if (s.points) {
                patch.points = [
                  [s.points[0][0] + dx, s.points[0][1] + dy],
                  [s.points[1][0] + dx, s.points[1][1] + dy],
                ]
              }
              if (s.freehandPoints) {
                patch.freehandPoints = s.freehandPoints.map(([px, py]) => [px + dx, py + dy])
              }
              const updated = { ...s, ...patch }
              getShapesMap().set(id, updated)
              useShapeStore.getState()._upsertShape(updated)
            }
          })
          return
        }
      }

      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoManager.undo()
        return
      }
      if ((meta && e.shiftKey && e.key === 'z') || (meta && e.key === 'y')) {
        e.preventDefault()
        undoManager.redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if ((e.target as HTMLElement).tagName === 'TEXTAREA') return
        const { selectedIds } = useSelectionStore.getState()
        if (selectedIds.size === 0) return
        if (e.key === 'Backspace' && (e.target as HTMLElement).tagName !== 'BODY') return
        e.preventDefault()
        selectedIds.forEach((id) => removeShape(id))
        useSelectionStore.getState().deselectAll()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Wheel zoom / pan
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const store = useUiStore.getState()
      store.setFollowing(null)
      if (e.ctrlKey || e.metaKey) {
        const rect = canvas!.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const factor = e.deltaY < 0 ? 1.1 : 0.9
        const newZoom = Math.max(0.1, Math.min(10, store.viewport.zoom * factor))
        const scale = newZoom / store.viewport.zoom
        store.setViewport({
          zoom: newZoom,
          offsetX: mx - scale * (mx - store.viewport.offsetX),
          offsetY: my - scale * (my - store.viewport.offsetY),
        })
      } else {
        store.setViewport({
          offsetX: store.viewport.offsetX - e.deltaX,
          offsetY: store.viewport.offsetY - e.deltaY,
        })
      }
      engineRef.current?.requestRender()
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 4,
          background: '#ffffff',
          borderRadius: 8,
          padding: '6px 10px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          zIndex: 10,
        }}
      >
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            style={{
              ...btnBase,
              fontWeight: activeTool === t.id ? 700 : 400,
              background: activeTool === t.id ? '#6366f1' : '#f1f5f9',
              color: activeTool === t.id ? '#fff' : '#334155',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
