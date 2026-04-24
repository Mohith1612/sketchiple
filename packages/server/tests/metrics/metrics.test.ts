import { beforeEach, describe, expect, it } from 'vitest'
import {
  decGauge,
  getMetricsSnapshot,
  incCounter,
  incGauge,
  renderPrometheusMetrics,
  resetMetrics,
  setGauge,
} from '../../src/metrics/metrics.ts'

describe('metrics registry', () => {
  beforeEach(() => {
    resetMetrics()
  })

  it('tracks counters and gauges', () => {
    incCounter('ws_messages_received_total')
    incCounter('ws_messages_received_total', 2)
    incCounter('ws_rate_limit_exceeded_total')

    incGauge('ws_active_sockets', 3)
    decGauge('ws_active_sockets', 1)
    setGauge('rooms_active', 2)

    const snapshot = getMetricsSnapshot()
    expect(snapshot.counters.ws_messages_received_total).toBe(3)
    expect(snapshot.counters.ws_rate_limit_exceeded_total).toBe(1)
    expect(snapshot.gauges.ws_active_sockets).toBe(2)
    expect(snapshot.gauges.rooms_active).toBe(2)
  })

  it('renders prometheus-style output', () => {
    incCounter('ws_sync_messages_total', 4)
    setGauge('rooms_active', 1)

    const text = renderPrometheusMetrics()

    expect(text).toContain('# TYPE rooms_active gauge')
    expect(text).toContain('rooms_active 1')
    expect(text).toContain('# TYPE ws_sync_messages_total counter')
    expect(text).toContain('ws_sync_messages_total 4')
  })
})
