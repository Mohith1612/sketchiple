# canvas-draw

A real-time collaborative whiteboard using CRDT-based sync (Yjs) and a high-performance WebSocket backend (uWebSockets.js). Multiple users share a canvas via a URL — no auth, no database.

## Running locally

```bash
pnpm install

# Start both client and server
pnpm dev

# Or individually
pnpm --filter @canvas-draw/server dev   # uWS server  → ws://localhost:3001
pnpm --filter @canvas-draw/client dev   # Vite client → http://localhost:5173
```

Open `http://localhost:5173` in two browser tabs — a room ID is auto-generated in the URL hash. Share the URL to collaborate.

```bash
pnpm typecheck   # type-check all packages
pnpm lint        # ESLint
pnpm test        # Vitest (workspace)
pnpm security:deps # production dependency audit (high+)
pnpm format      # Prettier
```

## Project structure

```
packages/
  shared/    # Types, protocol constants (MSG_SYNC/MSG_AWARENESS), UUIDv7 newId()
  client/    # Vite + React SPA — canvas rendering, Yjs, Zustand, WebSocket provider
  server/    # Node.js + uWebSockets.js — room relay, Yjs sync, awareness broadcast
```

## Architecture

**State ownership:**
- Yjs (`Y.Map<string, Shape>`) is the source of truth for shapes — handles conflict-free sync across clients
- Zustand holds derived UI state (shapes mirrored from Yjs, viewport, tool selection, presence)
- IndexedDB (y-indexeddb) persists the Yjs doc locally — shapes survive page reload with no server

**Sync flow:**

```
pointer event → ShapeActions (Yjs transact + Zustand direct update)
             → ydoc 'update' event → WebSocket → uWS server
             → server applies update, broadcasts to room peers
             → peers: ydoc update → Zustand observer bridge → re-render
```

**WebSocket protocol:** Binary, framed with a single outer type byte (`0 = SYNC`, `1 = AWARENESS`), then a y-protocols payload encoded with lib0. The client uses a manual provider (not y-websocket, which is incompatible with uWS).

**Room lifecycle:** Rooms are in-memory only. When the last client disconnects the Y.Doc is destroyed. On reconnect, the client pushes its IndexedDB state to the fresh server doc via the sync handshake.

## Key env vars

| Variable | Package | Default | Description |
|---|---|---|---|
| `PORT` | server | `3001` | uWS listen port |
| `WS_ALLOWED_ORIGINS` | server | _(unset)_ | Comma-separated list of allowed WebSocket Origin values. If unset, loopback localhost origins are allowed for development. |
| `WS_MAX_AWARENESS_UPDATE_BYTES` | server | `131072` | Maximum accepted awareness payload size (bytes). Larger payloads are rejected. |
| `WS_MAX_BUFFERED_BYTES` | server | `262144` | Per-socket backpressure threshold in bytes before queuing. |
| `WS_MAX_QUEUED_MESSAGES` | server | `64` | Per-socket queued message cap under backpressure. Messages beyond this limit are dropped. |
| `WS_DRAIN_BATCH_SIZE` | server | `64` | Maximum queued messages flushed per drain callback tick. |
| `VITE_WS_URL` | client | _(unset)_ | WS server base URL for production (e.g. `wss://api.example.com`). Unset in dev — Vite proxy handles `/ws` routing. |
| `VITE_WS_MAX_RETRIES` | client | `20` | Maximum reconnect attempts before showing exhausted status in UI/debug panel. |

## Health check

```
GET http://localhost:3001/health → { "ok": true }
```

## Metrics

```
GET http://localhost:3001/metrics
```

Prometheus-style text output includes core signals such as `ws_active_sockets`, `rooms_active`, `ws_messages_received_total`, and backpressure/rate-limit counters.

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for quality gates and PR checklist.

## Release operations

- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Rollback runbook](docs/ROLLBACK_RUNBOOK.md)

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for secure deployment defaults, operational limits, and audit guidance.
