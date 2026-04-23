import { describe, expect, it } from 'vitest'
import { rdp } from '../../src/lib/rdp.ts'

describe('rdp()', () => {
  it('returns a shallow copy when fewer than 3 points are provided', () => {
    const pts: [number, number][] = [[0, 0], [1, 1]]
    const simplified = rdp(pts, 2)

    expect(simplified).toEqual(pts)
    expect(simplified).not.toBe(pts)
  })

  it('simplifies a nearly straight polyline to endpoints', () => {
    const pts: [number, number][] = [
      [0, 0],
      [1, 0.05],
      [2, -0.03],
      [3, 0.02],
      [4, 0],
    ]

    const simplified = rdp(pts, 0.2)
    expect(simplified).toEqual([
      [0, 0],
      [4, 0],
    ])
  })
})
