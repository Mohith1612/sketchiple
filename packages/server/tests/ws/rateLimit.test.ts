import { describe, expect, it } from 'vitest'
import { allowWsMessage, createWsRateLimitState } from '../../src/ws/rateLimit.ts'

describe('ws rate limiting', () => {
  it('starts with a full token bucket', () => {
    const state = createWsRateLimitState(1000)

    expect(state.tokens).toBe(300)
    expect(state.lastRefillAt).toBe(1000)
    expect(allowWsMessage(state, 1000)).toBe(true)
    expect(state.tokens).toBe(299)
  })

  it('rejects messages when the bucket is exhausted', () => {
    const state = createWsRateLimitState(0)

    for (let index = 0; index < 300; index += 1) {
      expect(allowWsMessage(state, 0)).toBe(true)
    }

    expect(allowWsMessage(state, 0)).toBe(false)
  })

  it('refills over time', () => {
    const state = createWsRateLimitState(0)

    for (let index = 0; index < 300; index += 1) {
      expect(allowWsMessage(state, 0)).toBe(true)
    }

    expect(allowWsMessage(state, 2500)).toBe(true)
  })
})
