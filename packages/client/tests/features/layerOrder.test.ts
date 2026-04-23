import { beforeEach, describe, expect, it } from 'vitest'
import type { Shape } from '@canvas-draw/shared'
import { addShape, bringForward, sendBackward, bringToFront, sendToBack } from '../../src/features/shapes/ShapeActions.ts'
import { useShapeStore } from '../../src/store/shapeStore.ts'
import { getShapesMap } from '../../src/crdt/doc.ts'

function makeRect(id: string): Shape {
  return {
    id,
    type: 'rect',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    stroke: '#000',
    fill: '#fff',
    strokeWidth: 2,
    opacity: 1,
  }
}

describe('layer ordering actions', () => {
  beforeEach(() => {
    getShapesMap().clear()
    useShapeStore.setState({ shapes: {} })
  })

  it('brings selected shape to front', () => {
    addShape(makeRect('a'))
    addShape(makeRect('b'))
    addShape(makeRect('c'))

    bringToFront(['a'])

    expect(Object.keys(useShapeStore.getState().shapes)).toEqual(['b', 'c', 'a'])
  })

  it('sends selected shape to back', () => {
    addShape(makeRect('a'))
    addShape(makeRect('b'))
    addShape(makeRect('c'))

    sendToBack(['c'])

    expect(Object.keys(useShapeStore.getState().shapes)).toEqual(['c', 'a', 'b'])
  })

  it('moves selected shape one step forward/backward', () => {
    addShape(makeRect('a'))
    addShape(makeRect('b'))
    addShape(makeRect('c'))

    bringForward(['a'])
    expect(Object.keys(useShapeStore.getState().shapes)).toEqual(['b', 'a', 'c'])

    sendBackward(['a'])
    expect(Object.keys(useShapeStore.getState().shapes)).toEqual(['a', 'b', 'c'])
  })
})
