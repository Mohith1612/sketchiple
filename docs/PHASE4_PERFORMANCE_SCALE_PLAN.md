# Phase 4 Plan — Performance and Scale

Goal: improve runtime performance, scalability confidence, and operational alert quality while preserving collaboration correctness.

## Success criteria

- Stable interaction at typical load (small/medium rooms) with no visible UI jank in normal editing.
- Documented stress baseline for high-shape scenarios and multi-client sync throughput.
- Actionable server/client metrics with threshold-based alerts.
- At least one implemented optimization in client rendering path and one in server processing path.

## Work breakdown

| ID | Task | Priority | Effort | Depends on |
|---|---|---|---|---|
| P4-1 | Add client perf instrumentation (FPS/frame-time) | P0 | M | none |
| P4-2 | Add stress harness (shape-count + multi-client WS load) | P0 | L | P4-1 |
| P4-3 | Baseline profiling + bottleneck report | P0 | M | P4-1, P4-2 |
| P4-4 | Client optimization pass #1 (dirty-rect/partial redraw) | P1 | L | P4-3 |
| P4-5 | Client optimization pass #2 (freehand/path memoization) | P1 | M | P4-3 |
| P4-6 | Server optimization pass (broadcast/drain batching tuning) | P1 | M | P4-3 |
| P4-7 | Alert thresholds + dashboard-ready metric set | P0 | M | P4-2, P4-3 |
| P4-8 | Regression/perf guardrails in CI docs/scripts | P2 | S | P4-4..P4-7 |

Legend: S = 0.5–1 day, M = 1–2 days, L = 2–4 days

## Detailed actions

### P4-1 Client instrumentation

- Add lightweight runtime sampler for:
  - FPS (instant + rolling average)
  - frame time percentiles (p50/p95/p99)
  - rendered shape count
- Surface metrics in dev debug panel and optional console summary.

### P4-2 Stress harness

- Add repeatable scripts to generate:
  - large shape counts (1k/5k/10k)
  - heavy freehand paths
  - N simulated WS clients with sync traffic
- Capture run outputs in markdown artifacts under docs or temp reports.

### P4-3 Profiling and bottlenecks

- Profile client render loop under stress scenarios.
- Profile server message processing and drain behavior.
- Produce bottleneck summary with ranked optimization candidates.

### P4-4 Client optimization pass #1

- Implement partial redraw strategy where feasible.
- Reduce full-canvas invalidation frequency.
- Verify no correctness regressions in selection/drag/collaboration.

### P4-5 Client optimization pass #2

- Memoize expensive path construction (especially freehand).
- Reuse prepared paths/styles where safe.
- Confirm memory usage remains stable.

### P4-6 Server optimization pass

- Tune drain/batching behavior with measured limits.
- Validate fair delivery under backpressure.
- Ensure no protocol correctness regressions.

### P4-7 Alerts and thresholds

- Define initial thresholds for:
  - `ws_message_errors_total` rate
  - `ws_backpressure_drops_total` growth
  - `ws_rate_limit_exceeded_total` spikes
  - abnormal `ws_active_sockets` or `rooms_active` patterns
- Document runbook linkage for each alert.

### P4-8 Guardrails

- Add script/documented process for periodic perf runs.
- Add release checklist references requiring perf baseline check for large changes.

## Milestones

1. Baseline Ready (P4-1..P4-3)
2. Optimization Round 1 Complete (P4-4..P4-6)
3. Alerting and Guardrails Complete (P4-7..P4-8)

## Validation checklist per milestone

- `pnpm test`
- `pnpm lint`
- `pnpm -r typecheck`
- `pnpm e2e`
- Stress/perf run artifact generated and reviewed

## Risks and mitigations

- Risk: performance tuning introduces rendering bugs.
  - Mitigation: pair each optimization with targeted unit/E2E coverage.
- Risk: synthetic load does not match production behavior.
  - Mitigation: use multiple scenarios and compare trends, not single values.
- Risk: over-aggressive alerts cause noise.
  - Mitigation: start with conservative thresholds and tune iteratively.
