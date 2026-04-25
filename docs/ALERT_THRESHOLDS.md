# Alert Thresholds

Prometheus metrics are available at `GET /metrics`. This document defines
warning and critical thresholds for each signal, and links to the relevant
runbook sections.

---

## Counter-rate thresholds

Counter spikes are best evaluated as **rate-over-1-minute** (e.g., in Grafana:
`rate(metric[1m])`). The thresholds below are per-minute rates unless noted.

| Metric | Warning | Critical | Runbook |
|---|---|---|---|
| `ws_message_errors_total` | > 5/min | > 20/min | [Protocol errors](#protocol-errors) |
| `ws_rate_limit_exceeded_total` | > 10/min | > 50/min | [Rate limiting](#rate-limiting) |
| `ws_backpressure_drops_total` | > 10/min | > 50/min | [Backpressure drops](#backpressure-drops) |
| `ws_sync_messages_total` | < 1/min (when rooms active) | 0 for > 5 min | [Sync stall](#sync-stall) |

---

## Gauge thresholds

| Metric | Warning | Critical | Notes |
|---|---|---|---|
| `ws_active_sockets` | > 500 | > 1000 | Scale horizontally above warning |
| `rooms_active` | > 200 | > 500 | Monitor memory usage above warning |

---

## Client-side FPS (from DebugPanel / future telemetry)

| Scenario | Warning | Critical |
|---|---|---|
| Idle canvas (any shape count) | < 50fps | < 30fps |
| Active drawing | < 40fps | < 20fps |
| 2+ remote cursors animating | < 45fps | < 25fps |

---

## Runbook notes

### Protocol errors
Elevated `ws_message_errors_total` means clients are sending malformed payloads.
- Check server logs for `ws message error` entries with room/user context.
- A sudden spike after a client deploy often means a protocol version mismatch.
- See [Rollback Runbook](ROLLBACK_RUNBOOK.md#2-confirm-impact).

### Rate limiting
`ws_rate_limit_exceeded_total` > warning threshold means one or more clients are
sending faster than the per-connection rate limit allows.
- Identify the offending `userId`/`roomId` from server logs.
- If it is a legitimate client (e.g., heavy freehand drawing), consider raising
  the rate limit via `WS_RATE_LIMIT_*` env vars; if it looks like abuse, block
  the origin.

### Backpressure drops
`ws_backpressure_drops_total` > warning threshold means the server is dropping
messages for slow consumers (clients with slow network or high CPU).
- Short bursts are normal (e.g., one client on a poor connection).
- Sustained drops suggest the `WS_MAX_BUFFERED_BYTES` / `WS_MAX_QUEUED_MESSAGES`
  defaults are too low, or a client is genuinely unable to keep up.
- Tune env vars based on `docs/PERF_BASELINE.md` measurements.
- See [Rollback Runbook](ROLLBACK_RUNBOOK.md#2-confirm-impact).

### Sync stall
No `ws_sync_messages_total` increment while `rooms_active > 0` for several
minutes means the sync pipeline has stalled.
- Check if all rooms are idle (no active editing) — that is expected.
- If rooms appear active but no sync traffic, check for WebSocket connection
  errors and server restarts that drained in-memory room state.
- Clients should recover automatically on reconnect via IndexedDB restore.
