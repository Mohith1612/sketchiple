import { beforeEach, describe, expect, it } from 'vitest'
import type { Shape } from '@canvas-draw/shared'
import {
  addShape,
  groupSelected,
  ungroupSelected,
  alignSelected,
} from '../../src/features/shapes/ShapeActions.ts'
import { useShapeStore } from '../../src/store/shapeStore.ts'
import { getShapesMap } from '../../src/crdt/doc.ts'

function makeRect(id: string, x: number, y: number, width = 10, height = 10): Shape {
  return {
    id,
    type: 'rect',
    x,
    y,
    width,
    height,
    stroke: '#000',
    fill: '#fff',
    strokeWidth: 2,
    opacity: 1,
  }
}

describe('group and align actions', () => {
  beforeEach(() => {
    getShapesMap().clear()
    useShapeStore.setState({ shapes: {} })
  })

  it('groups and ungroups selected shapes', () => {
    addShape(makeRect('a', 0, 0))
    addShape(makeRect('b', 20, 20))

    const gid = groupSelected(['a', 'b'])
    expect(gid).toBeTruthy()

    const afterGroup = useShapeStore.getState().shapes
    expect(afterGroup.a?.groupId).toBe(gid)
    expect(afterGroup.b?.groupId).toBe(gid)

    ungroupSelected(['a', 'b'])

    const afterUngroup = useShapeStore.getState().shapes
    expect(afterUngroup.a?.groupId).toBeUndefined()
    expect(afterUngroup.b?.groupId).toBeUndefined()
  })

  it('aligns selected shapes to left edge', () => {
    addShape(makeRect('a', 10, 0))
    addShape(makeRect('b', 40, 20))
    addShape(makeRect('c', 60, 30))

    alignSelected(['a', 'b', 'c'], 'left')

    const { a, b, c } = useShapeStore.getState().shapes
    expect(a?.x).toBe(10)
    expect(b?.x).toBe(10)
    expect(c?.x).toBe(10)
  })

  it('aligns selected shapes to vertical center', () => {
    addShape(makeRect('a', 0, 0, 10, 10))
    addShape(makeRect('b', 20, 40, 10, 20))

    alignSelected(['a', 'b'], 'vcenter')

    const { a, b } = useShapeStore.getState().shapes
    const aCenter = (a?.y ?? 0) + (a?.height ?? 0) / 2
    const bCenter = (b?.y ?? 0) + (b?.height ?? 0) / 2
    expect(aCenter).toBeCloseTo(bCenter)
  })
})
