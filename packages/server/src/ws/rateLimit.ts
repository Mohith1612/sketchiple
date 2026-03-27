export interface WsRateLimitState {
  tokens: number
  lastRefillAt: number
}

export interface WsRateLimitConfig {
  maxTokens: number
  refillWindowMs: number
}

// 300 tokens / 5 s = 60 msgs/sec steady-state refill.
// Expected peak during active editing: ~31 shape sync + ~30 throttled awareness = ~61/sec.
// The burst budget (300) absorbs the initial sync handshake without triggering limits.
export const DEFAULT_WS_RATE_LIMIT: WsRateLimitConfig = {
  maxTokens: 300,
  refillWindowMs: 5000,
}

export function createWsRateLimitState(now: number = Date.now()): WsRateLimitState {
  return {
    tokens: DEFAULT_WS_RATE_LIMIT.maxTokens,
    lastRefillAt: now,
  }
}

export function allowWsMessage(
  state: WsRateLimitState,
  now: number = Date.now(),
  config: WsRateLimitConfig = DEFAULT_WS_RATE_LIMIT,
): boolean {
  const elapsed = Math.max(0, now - state.lastRefillAt)
  const refillRate = config.maxTokens / config.refillWindowMs
  const refilledTokens = elapsed * refillRate

  state.tokens = Math.min(config.maxTokens, state.tokens + refilledTokens)
  state.lastRefillAt = now

  if (state.tokens < 1) {
    return false
  }

  state.tokens -= 1
  return true
}
