import type { Shape } from '@canvas-draw/shared'
import { renderShape } from '../shapes/ShapeRenderer.js'
import { getBoundingBox } from '../../lib/boundingBox.js'
import { getShapesForExport } from './exportUtils.js'

const EXPORT_WIDTH = 1920
const EXPORT_HEIGHT = 1080
const EXPORT_PADDING = 16

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function getBounds(shapes: Shape[]): { x: number; y: number; width: number; height: number } | null {
  if (shapes.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const shape of shapes) {
    const bb = getBoundingBox(shape)
    minX = Math.min(minX, bb.x)
    minY = Math.min(minY, bb.y)
    maxX = Math.max(maxX, bb.x + bb.width)
    maxY = Math.max(maxY, bb.y + bb.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export async function exportToPNG(options?: { selectedOnly?: boolean }): Promise<void> {
  const selectedOnly = options?.selectedOnly ?? false
  const shapes = getShapesForExport(selectedOnly)

  const bounds = selectedOnly ? getBounds(shapes) : null
  const width = bounds ? Math.max(1, Math.ceil(bounds.width + EXPORT_PADDING * 2)) : EXPORT_WIDTH
  const height = bounds ? Math.max(1, Math.ceil(bounds.height + EXPORT_PADDING * 2)) : EXPORT_HEIGHT

  const offscreen = new OffscreenCanvas(width, height)
  const ctx = offscreen.getContext('2d')
  if (!ctx) throw new Error('Could not get OffscreenCanvas 2d context')

  // White background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  if (bounds) {
    ctx.save()
    ctx.translate(-bounds.x + EXPORT_PADDING, -bounds.y + EXPORT_PADDING)
  }

  // Render in world coordinates (no viewport transform)
  for (const shape of shapes) {
    renderShape(ctx as unknown as CanvasRenderingContext2D, shape)
  }

  if (bounds) ctx.restore()

  const blob = await offscreen.convertToBlob({ type: 'image/png' })
  downloadBlob(blob, selectedOnly ? 'canvas-draw.selected.png' : 'canvas-draw.png')
}
