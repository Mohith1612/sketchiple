import { useEffect, useRef, useState } from 'react'
import { CanvasEngine } from './canvas/CanvasEngine.js'
import { renderScene } from './canvas/CanvasRenderer.js'
import { createDrawingHandlers } from './features/drawing/index.js'
import type { DraftShape } from './features/drawing/index.js'
import { useUiStore, type Tool } from './store/uiStore.js'

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

    engine.requestRender()

    return () => {
      cleanupDrawing()
      engine.destroy()
    }
  }, [])

  // Re-render whenever store state changes
  useEffect(() => {
    engineRef.current?.requestRender()
  })

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
