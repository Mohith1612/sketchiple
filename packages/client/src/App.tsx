import { useEffect, useRef } from 'react'
import { CanvasEngine } from './canvas/CanvasEngine.js'
import { renderScene } from './canvas/CanvasRenderer.js'

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
