import { useEffect, useRef } from 'react'
import { CanvasEngine } from './canvas/CanvasEngine.js'
import { renderScene } from './canvas/CanvasRenderer.js'
import { useUiStore, type Tool } from './store/uiStore.js'

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
  const activeTool = useUiStore((s) => s.activeTool)
  const setTool = useUiStore((s) => s.setTool)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new CanvasEngine(canvas)

    engine.setRenderCallback((ctx) => {
      renderScene(ctx, null)
    })

    engine.requestRender()

    return () => {
      engine.destroy()
    }
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
