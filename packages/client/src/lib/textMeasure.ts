import type { Shape } from '@canvas-draw/shared'

const _cache = new Map<string, { width: number; height: number }>()
let _offscreenCtx: CanvasRenderingContext2D | null = null

function getCtx(): CanvasRenderingContext2D {
  if (!_offscreenCtx) {
    _offscreenCtx = document.createElement('canvas').getContext('2d')!
  }
  return _offscreenCtx
}

function cacheKey(shape: Shape): string {
  return `${shape.content ?? ''}|${shape.fontSize ?? 16}|${shape.fontFamily ?? ''}|${shape.fontWeight ?? 'normal'}`
}

/**
 * Returns pixel dimensions for a text shape's content.
 * Results are cached by (content, fontSize, fontFamily).
 */
export function measureTextShape(shape: Shape): { width: number; height: number } {
  const key = cacheKey(shape)
  const cached = _cache.get(key)
  if (cached) return cached

  const ctx = getCtx()
  const fontSize = shape.fontSize ?? 16
  const fontWeight = shape.fontWeight ?? 'normal'
  ctx.font = `${fontWeight} ${fontSize}px ${shape.fontFamily ?? 'system-ui, sans-serif'}`
  const lines = (shape.content ?? '').split('\n')
  const lineH = fontSize * 1.4
  const result = {
    width: Math.max(40, Math.max(...lines.map(l => ctx.measureText(l).width)) + 12),
    height: Math.max(24, lines.length * lineH + 8),
  }
  _cache.set(key, result)
  return result
}

/** Evict cached measurement for a shape (call before content changes). */
export function invalidateTextMeasure(shape: Shape): void {
  _cache.delete(cacheKey(shape))
}
