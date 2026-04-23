import { beforeEach, describe, expect, it } from 'vitest'
import type { Shape } from '@canvas-draw/shared'
import { resolveArrowEndpoints, snapToShape } from '../../src/features/shapes/arrowBinding.ts'
import { useShapeStore } from '../../src/store/shapeStore.ts'

function rect(id: string, x: number, y: number, width: number, height: number): Shape {
  return {
    id,
    type: 'rect',
    x,
    y,
    width,
    height,
    stroke: '#000000',
    fill: '#ffffff',
    strokeWidth: 2,
    opacity: 1,
  }
}

describe('arrowBinding', () => {
  beforeEach(() => {
    useShapeStore.setState({ shapes: {} })
  })

  it('resolves bound arrow endpoints from shape anchors', () => {
    const from = rect('from', 10, 20, 100, 80)
    const to = rect('to', 300, 200, 120, 60)

    useShapeStore.setState({
      shapes: {
        [from.id]: from,
        [to.id]: to,
      },
    })

    const arrow: Shape = {
      id: 'a1',
      type: 'arrow',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      stroke: '#000000',
      fill: 'transparent',
      strokeWidth: 2,
      opacity: 1,
      points: [[0, 0], [1, 1]],
      fromShapeId: from.id,
      toShapeId: to.id,
      fromAnchor: { x: 0.5, y: 0 },
      toAnchor: { x: 1, y: 0.5 },
    }

    const [start, end] = resolveArrowEndpoints(arrow)

    expect(start).toEqual([60, 20])
    expect(end).toEqual([420, 230])
  })

  it('snaps to nearest anchor in pixel radius', () => {
    const target = rect('target', 100, 100, 200, 100)
    useShapeStore.setState({ shapes: { [target.id]: target } })

    const snap = snapToShape(201, 150, 'other', 1, 0, 0, 8)

    expect(snap).not.toBeNull()
    expect(snap?.shapeId).toBe('target')
    expect(snap?.anchor).toEqual({ x: 0.5, y: 0.5 })
    expect(snap?.x).toBe(200)
    expect(snap?.y).toBe(150)
  })
})
