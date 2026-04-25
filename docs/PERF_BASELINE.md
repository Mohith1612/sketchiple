# Performance Baseline

Run the harnesses to populate this file, then commit the results.

```bash
pnpm perf:shapes          # in-memory Yjs + curve-compute benchmark
pnpm perf:ws              # multi-client WS load (server must be running)
```

---

## Shape-count benchmark (`pnpm perf:shapes`)

> Last measured: 2026-04-23  
> Node version: v22.14.0

| count | Yjs insert (total) | Yjs insert (per shape) | Zustand iterate | Freehand curve (per shape) |
|------:|-------------------:|-----------------------:|----------------:|---------------------------:|
|   100 | 4.87ms | 0.05ms | 0.16ms | 0.09ms |
|   500 | 2.70ms | 0.01ms | 0.27ms | 0.00ms |
|  1000 | 16.08ms | 0.02ms | 0.64ms | 0.01ms |
|  2000 | 11.42ms | 0.01ms | 1.25ms | 0.00ms |

**Bottleneck notes:** Yjs insert at 1000 shapes is ~16ms (one batch `transact()`). Zustand iteration is negligible. Freehand curve compute is sub-millisecond per shape once warmed up. The dominant rendering cost is expected to be the canvas draw calls themselves, not Yjs or Zustand. Path2D caching (P4-5) eliminates repeated curve recomputation for static shapes.

---

## WS load benchmark (`pnpm perf:ws`)

> Last measured: _not yet run_  
> Config: `PERF_WS_CLIENTS=20 PERF_WS_UPDATES=50`

| Metric | avg | p50 | p95 |
|--------|----:|----:|----:|
| Connection time (ms) | — | — | — |
| Awareness updates time (ms) | — | — | — |

| Server counter | value after test |
|---|---|
| `ws_messages_received_total` | — |
| `ws_awareness_messages_total` | — |
| `ws_backpressure_drops_total` | — |
| `ws_rate_limit_exceeded_total` | — |
| `ws_message_errors_total` | — |
| Throughput (msgs/sec) | — |

**Bottleneck notes:** _fill in after first run_

---

## FPS baseline (manual — from DebugPanel)

Open `http://localhost:5173` in dev, check the DebugPanel overlay at bottom-right.

| Scenario | FPS | frame time (ms) |
|---|----:|----------------:|
| Empty canvas, idle | — | — |
| 100 rect shapes, idle | — | — |
| 500 rect shapes, idle | — | — |
| 1000 rect shapes, idle | — | — |
| 10 freehand shapes (200 pts each) | — | — |
| Active freehand drawing | — | — |
| 2 remote users with moving cursors | — | — |

**Target:** 60fps (16ms frame) at ≤500 shapes idle; ≥30fps at 1000 shapes.

---

## Optimization results

Fill in after each P4-4 / P4-5 optimization pass:

| Optimization | Before | After | Improvement |
|---|---|---|---|
| Path2D cache for freehand (P4-5) | — | — | — |
| Dirty-flag skip idle renders (P4-4) | — | — | — |
| Server drain batch tuning (P4-6) | — | — | — |
