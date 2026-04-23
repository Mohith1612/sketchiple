import { describe, expect, it } from 'vitest'
import { getBoundingBox } from '../../src/lib/boundingBox.ts'
import type { Shape } from '@canvas-draw/shared'

describe('getBoundingBox()', () => {
  it('returns the rect bounds for rect shapes', () => {
    const shape: Shape = {
      id: 's1',
      type: 'rect',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      stroke: '#000000',
      fill: '#ffffff',
      strokeWidth: 2,
      opacity: 1,
    }

    expect(getBoundingBox(shape)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    })
  })
})
