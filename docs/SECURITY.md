# Security Guide

## Dependency scanning

Use the production audit command from repo root:

- `pnpm security:deps`

This checks production dependencies for known vulnerabilities at severity `high` or `critical`.

Optional broader audit (includes dev dependencies):

- `pnpm security:deps:all`

## CI security gate

CI runs production dependency audit in [.github/workflows/ci.yml](../.github/workflows/ci.yml) under the `Dependency Security Audit` job.

## WebSocket security defaults

Server-side protections currently enabled:

- Origin allow-list validation (`WS_ALLOWED_ORIGINS`)
- Canonical UUID room-id validation
- Per-connection rate limiting
- Per-connection backpressure queue limits
- Inbound protocol framing validation
- Awareness payload size limit (`WS_MAX_AWARENESS_UPDATE_BYTES`)

## Operational limits and recommended values

Set these in production environment:

- `WS_ALLOWED_ORIGINS=https://<your-app-domain>`
- `WS_MAX_AWARENESS_UPDATE_BYTES=131072`
- `WS_MAX_BUFFERED_BYTES=262144`
- `WS_MAX_QUEUED_MESSAGES=64`
- `WS_DRAIN_BATCH_SIZE=64`
- `VITE_WS_MAX_RETRIES=20`

Tune based on expected room size and network behavior.

## Deployment guidance

- Terminate TLS at reverse proxy/load balancer and forward WebSocket upgrades.
- Restrict ingress to known domains and apply WAF/rate controls at edge when available.
- Keep dependency upgrades regular and re-run security audit in CI and before release.
- Monitor logs for rate-limit and backpressure drop warnings.

## Incident response checklist

If abnormal WS behavior is detected:

1. Verify recent deploy and dependency changes.
2. Review server logs for `rate limit exceeded`, `queue drop`, and protocol validation errors.
3. Check edge/proxy limits and origin configuration.
4. Rotate or tighten `WS_ALLOWED_ORIGINS` if abuse is suspected.
5. Patch and redeploy with updated limits as needed.
