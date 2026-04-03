export interface ThrottledFn<T extends unknown[]> {
  (...args: T): void
  flush(): void
  cancel(): void
}

/**
 * Throttle with leading + trailing edge support and flush/cancel.
 * Default: leading=true, trailing=true, interval=32ms (~30fps for Yjs sync).
 */
export function throttle<T extends unknown[]>(
  fn: (...args: T) => void,
  wait: number,
  opts: { leading?: boolean; trailing?: boolean } = { leading: true, trailing: true },
): ThrottledFn<T> {
  let lastCall = 0
  let trailingTimer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: T | null = null

  function invoke(args: T): void {
    lastCall = Date.now()
    fn(...args)
  }

  const throttled = function (...args: T): void {
    lastArgs = args
    const now = Date.now()
    const remaining = wait - (now - lastCall)

    if (trailingTimer !== null) {
      clearTimeout(trailingTimer)
      trailingTimer = null
    }

    if (remaining <= 0) {
      invoke(args)
    } else if (opts.leading && lastCall === 0) {
      invoke(args)
    } else if (opts.trailing !== false) {
      trailingTimer = setTimeout(() => {
        if (lastArgs !== null) invoke(lastArgs)
        trailingTimer = null
        lastArgs = null
      }, remaining)
    }
  } as ThrottledFn<T>

  throttled.flush = (): void => {
    if (trailingTimer !== null) {
      clearTimeout(trailingTimer)
      trailingTimer = null
    }
    if (lastArgs !== null) {
      invoke(lastArgs)
      lastArgs = null
    }
  }

  throttled.cancel = (): void => {
    if (trailingTimer !== null) {
      clearTimeout(trailingTimer)
      trailingTimer = null
    }
    lastArgs = null
  }

  return throttled
}
