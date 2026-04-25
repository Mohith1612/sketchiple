# Rollback Runbook

Use this runbook when a release causes production impact.

## Trigger conditions

Execute rollback if one or more of the following occur after deployment:

- Sustained collaboration failures (clients stuck not syncing).
- Significant spike in WS/protocol errors.
- Severe performance regression or service instability.
- Export/editor critical path broken for most users.

## 1) Stabilize and communicate

- [ ] Declare incident in team channel.
- [ ] Assign incident lead and recorder.
- [ ] Pause additional deployments.

## 2) Confirm impact

- [ ] Check `/health` endpoint for availability.
- [ ] Check `/metrics` for abnormal counters/gauges.
- [ ] Review server logs for:
  - `ws message error`
  - `ws message rate limit exceeded`
  - `ws queue drop due to backpressure`

## 3) Select rollback target

- [ ] Identify last known good release tag/version.
- [ ] Confirm matching client/server artifacts are available.

## 4) Execute rollback

Recommended order:

1. Roll back **server** to last stable version.
2. Roll back **client** to matching stable version.
3. Ensure environment variables are restored to known-good values.

## 5) Validate rollback success

- [ ] `/health` returns success.
- [ ] `/metrics` shows stable behavior (no continued spikes).
- [ ] Two-tab collaboration smoke test passes.
- [ ] Undo/redo and export smoke checks pass.

## 6) Recovery communication

- [ ] Announce rollback completed and service status.
- [ ] Update incident timeline with rollback start/end times.

## 7) Post-incident follow-up

- [ ] Open corrective-action tasks.
- [ ] Add/adjust tests to prevent recurrence.
- [ ] Update release checklist/runbook if process gaps were found.
