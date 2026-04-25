# Contributing

## Local quality checks (required before PR)

Run from repo root:

- `pnpm lint`
- `pnpm -r typecheck`
- `pnpm -r build`
- `pnpm test`
- `pnpm security:deps`

## Coding standards

- Keep TypeScript strict and avoid `any`.
- Prefer `import type` for type-only imports.
- Keep feature code modular (`features`, `store`, `canvas`, `crdt`).
- Avoid unrelated formatting-only edits in feature PRs.

## Testing expectations

- Add or update tests for every behavior change.
- Prefer pure logic unit tests first.
- Add integration tests for sync/protocol and collaboration flows when applicable.

## Pull request checklist

- [ ] Scope is focused and clearly described.
- [ ] Lint, typecheck, build, and tests pass locally.
- [ ] New behavior includes tests.
- [ ] Docs are updated when commands/config/behavior changed.
- [ ] Backward compatibility considered (or explicitly documented).

## Release process references

- [Release checklist](RELEASE_CHECKLIST.md)
- [Rollback runbook](ROLLBACK_RUNBOOK.md)
