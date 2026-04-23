import { describe, expect, it } from 'vitest'
import { computeJitteredBackoffMs } from '../../src/crdt/sync.ts'

describe('computeJitteredBackoffMs()', () => {
  it('uses exponential backoff capped by max delay', () => {
    expect(computeJitteredBackoffMs(1, 1000, 30_000, 0, 0.5)).toBe(1000)
    expect(computeJitteredBackoffMs(2, 1000, 30_000, 0, 0.5)).toBe(2000)
    expect(computeJitteredBackoffMs(3, 1000, 30_000, 0, 0.5)).toBe(4000)
    expect(computeJitteredBackoffMs(10, 1000, 30_000, 0, 0.5)).toBe(30_000)
  })

  it('applies jitter within expected range', () => {
    const min = computeJitteredBackoffMs(3, 1000, 30_000, 0.3, 0)
    const mid = computeJitteredBackoffMs(3, 1000, 30_000, 0.3, 0.5)
    const max = computeJitteredBackoffMs(3, 1000, 30_000, 0.3, 1)

    expect(min).toBe(2800)
    expect(mid).toBe(4000)
    expect(max).toBe(5199)
  })
})
