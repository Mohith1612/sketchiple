import type { Shape } from '@canvas-draw/shared'
import { getBoundingBox } from '../../lib/boundingBox.js'
import { resolveArrowEndpoints } from '../shapes/arrowBinding.js'
import { getShapesForExport } from './exportUtils.js'

const EXPORT_PADDING = 16

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
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
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
}

function renderShapeToSVG(shape: Shape): string {
  const opacity = shape.opacity
  const stroke = esc(shape.stroke)
  const fill = shape.fill === 'transparent' ? 'none' : esc(shape.fill)
  const strokeWidth = fmt(shape.strokeWidth)

  if (shape.type === 'rect') {
    return `<rect x="${fmt(shape.x)}" y="${fmt(shape.y)}" width="${fmt(shape.width)}" height="${fmt(shape.height)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${fmt(opacity)}" />`
  }

  if (shape.type === 'ellipse') {
    const cx = shape.x + shape.width / 2
    const cy = shape.y + shape.height / 2
    const rx = Math.abs(shape.width / 2)
    const ry = Math.abs(shape.height / 2)
    return `<ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(rx)}" ry="${fmt(ry)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${fmt(opacity)}" />`
  }

  if (shape.type === 'arrow') {
    const [start, end] = resolveArrowEndpoints(shape)
    const [x1, y1] = start
    const [x2, y2] = end
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const headLen = Math.max(12, shape.strokeWidth * 4)
    const hx1 = x2 - headLen * Math.cos(angle - Math.PI / 6)
    const hy1 = y2 - headLen * Math.sin(angle - Math.PI / 6)
    const hx2 = x2 - headLen * Math.cos(angle + Math.PI / 6)
    const hy2 = y2 - headLen * Math.sin(angle + Math.PI / 6)
    return [
      `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${fmt(opacity)}" stroke-linecap="round" />`,
      `<line x1="${fmt(x2)}" y1="${fmt(y2)}" x2="${fmt(hx1)}" y2="${fmt(hy1)}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${fmt(opacity)}" stroke-linecap="round" />`,
      `<line x1="${fmt(x2)}" y1="${fmt(y2)}" x2="${fmt(hx2)}" y2="${fmt(hy2)}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${fmt(opacity)}" stroke-linecap="round" />`,
    ].join('')
  }

  if (shape.type === 'text') {
    if (!shape.content) return ''
    const fontSize = shape.fontSize ?? 16
    const fontFamily = esc(shape.fontFamily ?? 'system-ui, sans-serif')
    const fontWeight = shape.fontWeight ?? 'normal'
    const textAlign = shape.textAlign ?? 'left'
    const lineH = fontSize * 1.4
    const textX = textAlign === 'left'
      ? shape.x
      : textAlign === 'center'
        ? shape.x + shape.width / 2
        : shape.x + shape.width
    const anchor = textAlign === 'left' ? 'start' : textAlign === 'center' ? 'middle' : 'end'
    const tspans = shape.content
      .split('\n')
      .map((line, idx) => `<tspan x="${fmt(textX)}" y="${fmt(shape.y + idx * lineH)}">${esc(line)}</tspan>`)
      .join('')
    return `<text fill="${stroke}" opacity="${fmt(opacity)}" font-size="${fmt(fontSize)}" font-family="${fontFamily}" font-weight="${fontWeight}" text-anchor="${anchor}">${tspans}</text>`
  }

  if (shape.type === 'freehand') {
    const pts = shape.freehandPoints ?? []
    if (pts.length < 2) return ''
    const points = pts.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ')
    return `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${fmt(opacity)}" stroke-linecap="round" stroke-linejoin="round" />`
  }

  return ''
}

export function generateSVG(shapes: Shape[], options?: { selectedOnly?: boolean }): string {
  const selectedOnly = options?.selectedOnly ?? false
  const bounds = getBounds(shapes)
  const width = bounds ? Math.ceil(bounds.width + EXPORT_PADDING * 2) : 1920
  const height = bounds ? Math.ceil(bounds.height + EXPORT_PADDING * 2) : 1080
  const tx = bounds ? -bounds.x + EXPORT_PADDING : 0
  const ty = bounds ? -bounds.y + EXPORT_PADDING : 0
  const body = shapes.map((shape) => renderShapeToSVG(shape)).join('')
  const groupOpen = bounds ? `<g transform="translate(${fmt(tx)} ${fmt(ty)})">` : '<g>'

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}">`,
    '<rect x="0" y="0" width="100%" height="100%" fill="white" />',
    groupOpen,
    body,
    '</g>',
    `<!-- selectedOnly:${selectedOnly ? 'true' : 'false'} -->`,
    '</svg>',
  ].join('')
}

export function exportToSVG(options?: { selectedOnly?: boolean }): void {
  const selectedOnly = options?.selectedOnly ?? false
  const shapes = getShapesForExport(selectedOnly)
  const svg = generateSVG(shapes, { selectedOnly })
  downloadBlob(
    new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
    selectedOnly ? 'canvas-draw.selected.svg' : 'canvas-draw.svg',
  )
}
