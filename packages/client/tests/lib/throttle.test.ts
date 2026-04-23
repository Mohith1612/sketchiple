import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { throttle } from '../../src/lib/throttle.ts'

describe('throttle()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('invokes trailing call once after wait window', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 50)

    throttled('a')
    throttled('b')
    throttled('c')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenLastCalledWith('a')

    vi.advanceTimersByTime(51)

    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('c')
  })

  it('flushes pending trailing invocation immediately', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled(1)
    throttled(2)

    expect(fn).toHaveBeenCalledTimes(1)
    throttled.flush()

    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith(2)
  })

  it('cancels pending trailing invocation', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled('first')
    throttled('second')
    throttled.cancel()

    vi.advanceTimersByTime(101)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenLastCalledWith('first')
  })
})
