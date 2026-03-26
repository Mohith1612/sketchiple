type CounterName =
  | 'ws_messages_received_total'
  | 'ws_message_errors_total'
  | 'ws_rate_limit_exceeded_total'
  | 'ws_sync_messages_total'
  | 'ws_awareness_messages_total'
  | 'ws_backpressure_drops_total'

type GaugeName =
  | 'ws_active_sockets'
  | 'rooms_active'

interface MetricsState {
  counters: Record<CounterName, number>
  gauges: Record<GaugeName, number>
}

const state: MetricsState = {
  counters: {
    ws_messages_received_total: 0,
    ws_message_errors_total: 0,
    ws_rate_limit_exceeded_total: 0,
    ws_sync_messages_total: 0,
    ws_awareness_messages_total: 0,
    ws_backpressure_drops_total: 0,
  },
  gauges: {
    ws_active_sockets: 0,
    rooms_active: 0,
  },
}

export function resetMetrics(): void {
  for (const key of Object.keys(state.counters) as CounterName[]) {
    state.counters[key] = 0
  }
  for (const key of Object.keys(state.gauges) as GaugeName[]) {
    state.gauges[key] = 0
  }
}

export function incCounter(name: CounterName, by = 1): void {
  state.counters[name] += by
}

export function setGauge(name: GaugeName, value: number): void {
  state.gauges[name] = value
}

export function incGauge(name: GaugeName, by = 1): void {
  state.gauges[name] += by
}

export function decGauge(name: GaugeName, by = 1): void {
  state.gauges[name] = Math.max(0, state.gauges[name] - by)
}

export function getMetricsSnapshot(): MetricsState {
  return {
    counters: { ...state.counters },
    gauges: { ...state.gauges },
  }
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = []

  lines.push('# TYPE ws_active_sockets gauge')
  lines.push(`ws_active_sockets ${state.gauges.ws_active_sockets}`)
  lines.push('# TYPE rooms_active gauge')
  lines.push(`rooms_active ${state.gauges.rooms_active}`)

  lines.push('# TYPE ws_messages_received_total counter')
  lines.push(`ws_messages_received_total ${state.counters.ws_messages_received_total}`)
  lines.push('# TYPE ws_message_errors_total counter')
  lines.push(`ws_message_errors_total ${state.counters.ws_message_errors_total}`)
  lines.push('# TYPE ws_rate_limit_exceeded_total counter')
  lines.push(`ws_rate_limit_exceeded_total ${state.counters.ws_rate_limit_exceeded_total}`)
  lines.push('# TYPE ws_sync_messages_total counter')
  lines.push(`ws_sync_messages_total ${state.counters.ws_sync_messages_total}`)
  lines.push('# TYPE ws_awareness_messages_total counter')
  lines.push(`ws_awareness_messages_total ${state.counters.ws_awareness_messages_total}`)
  lines.push('# TYPE ws_backpressure_drops_total counter')
  lines.push(`ws_backpressure_drops_total ${state.counters.ws_backpressure_drops_total}`)

  return `${lines.join('\n')}\n`
}
