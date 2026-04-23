import { describe, expect, it, vi } from 'vitest'
import type { Shape } from '@canvas-draw/shared'
import { renderShape } from '../../src/features/shapes/ShapeRenderer.ts'

function makeTextShape(overrides: Partial<Shape> = {}): Shape {
  return {
    id: 't1',
    type: 'text',
    x: 100,
    y: 50,
    width: 200,
    height: 40,
    content: 'Hello',
    fontSize: 16,
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'bold',
    textAlign: 'center',
    stroke: '#111111',
    fill: 'transparent',
    strokeWidth: 2,
    opacity: 1,
    ...overrides,
  }
}

describe('text rendering styles', () => {
  it('applies text align and font weight for text shapes', () => {
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      fillText: vi.fn(),
      globalAlpha: 1,
      strokeStyle: '#000',
      fillStyle: '#000',
      lineWidth: 1,
      font: '',
      textAlign: 'left' as CanvasTextAlign,
      textBaseline: 'alphabetic' as CanvasTextBaseline,
    } as unknown as CanvasRenderingContext2D

    renderShape(ctx, makeTextShape())

    expect(ctx.font).toContain('bold')
    expect(ctx.font).toContain('16px')
    expect(ctx.textAlign).toBe('center')
    expect(ctx.textBaseline).toBe('top')
    expect(ctx.fillText).toHaveBeenCalled()
  })
})
