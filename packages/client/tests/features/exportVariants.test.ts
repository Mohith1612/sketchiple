import { beforeEach, describe, expect, it } from 'vitest'
import type { Shape } from '@canvas-draw/shared'
import { addShape } from '../../src/features/shapes/ShapeActions.ts'
import { generateSVG } from '../../src/features/export/exportSVG.ts'
import { getShapesForExport } from '../../src/features/export/exportUtils.ts'
import { useShapeStore } from '../../src/store/shapeStore.ts'
import { useSelectionStore } from '../../src/features/selection/selectionStore.ts'
import { getShapesMap } from '../../src/crdt/doc.ts'

function makeRect(id: string, x: number, y: number): Shape {
  return {
    id,
    type: 'rect',
    x,
    y,
    width: 50,
    height: 30,
    stroke: '#000',
    fill: '#fff',
    strokeWidth: 2,
    opacity: 1,
  }
}

describe('export variants', () => {
  beforeEach(() => {
    getShapesMap().clear()
    useShapeStore.setState({ shapes: {} })
    useSelectionStore.setState({ selectedIds: new Set(), rubberBand: null })
  })

  it('returns only selected shapes for selected-only export', () => {
    addShape(makeRect('a', 0, 0))
    addShape(makeRect('b', 100, 100))
    useSelectionStore.getState().selectOne('b')

    const selected = getShapesForExport(true)
    expect(selected.map((s) => s.id)).toEqual(['b'])

    const all = getShapesForExport(false)
    expect(all.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('generates svg with expected root and shape tags', () => {
    const svg = generateSVG([
      {
        id: 't1',
        type: 'text',
        x: 10,
        y: 12,
        width: 100,
        height: 24,
        content: 'Hello',
        fontSize: 16,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        textAlign: 'center',
        stroke: '#111',
        fill: 'transparent',
        strokeWidth: 1,
        opacity: 1,
      },
      makeRect('r1', 20, 30),
    ])

    expect(svg).toContain('<svg')
    expect(svg).toContain('<text')
    expect(svg).toContain('<rect')
    expect(svg).toContain('font-weight="bold"')
    expect(svg).toContain('text-anchor="middle"')
  })
})
