# Release Checklist

Use this checklist for every production release.

## 1) Scope and change freeze

- [ ] Release scope is defined (features/fixes included).
- [ ] No unresolved blocker issues remain.
- [ ] Branch is up to date with main and conflict-free.

## 2) Quality gates (must pass)

Run from repository root:

- [ ] `pnpm lint`
- [ ] `pnpm -r typecheck`
- [ ] `pnpm -r build`
- [ ] `pnpm test`
- [ ] `pnpm e2e`
- [ ] `pnpm security:deps`

## 3) Performance verification

Run from repository root:

- [ ] `pnpm perf:shapes` — passes with no regression vs baseline in `docs/PERF_BASELINE.md`
- [ ] FPS in DebugPanel ≥ 50fps at 500 shapes (manual check in dev mode)
- [ ] No sustained `ws_backpressure_drops_total` spikes during `pnpm perf:ws`

If any perf regression is found, investigate before releasing. See
[Performance Baseline](PERF_BASELINE.md) and [Alert Thresholds](ALERT_THRESHOLDS.md).

## 4) Operational readiness

- [ ] Required environment variables are set for target environment.
- [ ] WebSocket origin allow-list is configured (`WS_ALLOWED_ORIGINS`).
- [ ] Capacity limits reviewed (`WS_MAX_BUFFERED_BYTES`, `WS_MAX_QUEUED_MESSAGES`, `WS_DRAIN_BATCH_SIZE`).
- [ ] Metrics endpoint is reachable (`/metrics`).
- [ ] Health endpoint is reachable (`/health`).

## 5) Release metadata

- [ ] Release notes/changelog updated.
- [ ] Version/tag prepared according to team policy.
- [ ] Rollback target identified (previous stable version/tag).

## 6) Deployment

- [ ] Deploy server.
- [ ] Deploy client.
- [ ] Validate collaborative sync in two-browser smoke test.

## 7) Post-deploy verification (first 15-30 min)

- [ ] No elevated error logs (`ws message error`, protocol validation failures).
- [ ] `ws_rate_limit_exceeded_total` and `ws_backpressure_drops_total` do not spike unexpectedly.
- [ ] `ws_active_sockets` and `rooms_active` behave as expected.
- [ ] Core flows verified: draw/sync, undo/redo, JSON/SVG export.

## 8) Closeout

- [ ] Mark release complete in tracker.
- [ ] Share release summary and known issues.
- [ ] If any regressions are observed, execute [Rollback Runbook](ROLLBACK_RUNBOOK.md).
