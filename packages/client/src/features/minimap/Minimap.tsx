import { useRef, useEffect } from 'react'
import { useShapeStore } from '../../store/shapeStore.js'
import { useUiStore, type Viewport } from '../../store/uiStore.js'
import { getBoundingBox } from '../../lib/boundingBox.js'
import type { Shape } from '@canvas-draw/shared'

const W = 180
const H = 120
const PAD = 8

interface MinimapTransform {
  scale: number
  ox: number
  oy: number
}

function computeTransform(shapes: Shape[]): MinimapTransform {
  if (!shapes.length) return { scale: 0.1, ox: PAD, oy: PAD }

  const bboxes = shapes.map(getBoundingBox)
  const minX = Math.min(...bboxes.map((b) => b.x))
  const minY = Math.min(...bboxes.map((b) => b.y))
  const maxX = Math.max(...bboxes.map((b) => b.x + b.width))
  const maxY = Math.max(...bboxes.map((b) => b.y + b.height))

  const worldW = maxX - minX || 1
  const worldH = maxY - minY || 1
  const scale = Math.min((W - PAD * 2) / worldW, (H - PAD * 2) / worldH)

  return { scale, ox: PAD - minX * scale, oy: PAD - minY * scale }
}

function renderMinimap(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  viewport: Viewport,
): void {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#f8f9fa'
  ctx.fillRect(0, 0, W, H)

  const { scale, ox, oy } = computeTransform(shapes)

  // Draw shapes as bounding box fills
  for (const shape of shapes) {
    const bb = getBoundingBox(shape)
    if (bb.width < 0.5 && bb.height < 0.5) continue
    ctx.globalAlpha = 0.6
    ctx.fillStyle = shape.fill && shape.fill !== 'transparent' ? shape.fill : '#94a3b8'
    ctx.strokeStyle = shape.stroke
    ctx.lineWidth = 0.5
    ctx.fillRect(bb.x * scale + ox, bb.y * scale + oy, bb.width * scale, bb.height * scale)
    ctx.strokeRect(bb.x * scale + ox, bb.y * scale + oy, bb.width * scale, bb.height * scale)
  }

  // Draw viewport rectangle
  const vpLeft = -viewport.offsetX / viewport.zoom
  const vpTop = -viewport.offsetY / viewport.zoom
  const vpW = window.innerWidth / viewport.zoom
  const vpH = window.innerHeight / viewport.zoom

  ctx.globalAlpha = 1
  ctx.strokeStyle = '#6366f1'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.strokeRect(vpLeft * scale + ox, vpTop * scale + oy, vpW * scale, vpH * scale)
  ctx.setLineDash([])

  // Outer border
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1)
}

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const shapes = useShapeStore((s) => Object.values(s.shapes))
  const viewport = useUiStore((s) => s.viewport)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    renderMinimap(ctx, shapes, viewport)
  }, [shapes, viewport])

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>): void {
    const allShapes = Object.values(useShapeStore.getState().shapes)
    const { scale, ox, oy } = computeTransform(allShapes)
    const rect = e.currentTarget.getBoundingClientRect()
    const worldX = (e.clientX - rect.left - ox) / scale
    const worldY = (e.clientY - rect.top - oy) / scale
    const vp = useUiStore.getState().viewport
    useUiStore.getState().setViewport({
      offsetX: window.innerWidth / 2 - worldX * vp.zoom,
      offsetY: window.innerHeight / 2 - worldY * vp.zoom,
    })
  }

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      onClick={handleClick}
      title="Minimap — click to navigate"
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        borderRadius: 6,
        cursor: 'pointer',
        zIndex: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      }}
    />
  )
}
