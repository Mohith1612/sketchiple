/**
 * WebSocket multi-client load harness — requires server running on localhost:3001.
 *
 * Opens K concurrent connections to a test room, runs the sync handshake,
 * fires N awareness updates per client, then reads /metrics.
 *
 * Run: pnpm perf:ws
 * Options (env vars):
 *   PERF_WS_CLIENTS=20     number of concurrent clients (default: 20)
 *   PERF_WS_UPDATES=50     awareness updates per client (default: 50)
 *   PERF_WS_URL=ws://...   server URL (default: ws://localhost:3001)
 */
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

const WS_URL = process.env.PERF_WS_URL ?? 'ws://localhost:3001'
const CLIENT_COUNT = Number(process.env.PERF_WS_CLIENTS ?? 20)
const UPDATES_PER_CLIENT = Number(process.env.PERF_WS_UPDATES ?? 50)

const MSG_SYNC = 0
const MSG_AWARENESS = 1
const ROOM_ID = '0195f4a0-0000-7000-8000-000000000001'  // fixed test room UUIDv7

function encodeSyncStep1(): Uint8Array {
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, MSG_SYNC)
  encoding.writeVarUint(enc, 0)   // messageYjsSyncStep1
  encoding.writeVarUint8Array(enc, new Uint8Array(0))  // empty state vector
  return encoding.toUint8Array(enc)
}

function encodeAwarenessUpdate(clientId: number, x: number, y: number): Uint8Array {
  // Minimal awareness update: [{clientId, clock, state}]
  const stateJson = JSON.stringify({ cursor: { x, y } })
  const enc = encoding.createEncoder()
  encoding.writeVarUint(enc, MSG_AWARENESS)
  // awareness protocol: varUint count, then [clientId, clock, stateJson]
  encoding.writeVarUint(enc, 1)
  encoding.writeVarUint(enc, clientId)
  encoding.writeVarUint(enc, 1)  // clock
  encoding.writeVarString(enc, stateJson)
  return encoding.toUint8Array(enc)
}

async function runClient(clientIdx: number): Promise<{ connectMs: number; updatesMs: number }> {
  return new Promise((resolve, reject) => {
    const t0 = performance.now()
    const ws = new WebSocket(`${WS_URL}/ws/${ROOM_ID}`)
    ws.binaryType = 'arraybuffer'

    let connectMs = 0
    let synced = false
    let updatesSent = 0
    const t1 = performance.now()

    ws.onopen = () => {
      connectMs = performance.now() - t0
      ws.send(encodeSyncStep1())
    }

    ws.onmessage = () => {
      if (!synced) {
        synced = true
        const updatesStart = performance.now()
        // Send awareness updates in a loop
        const interval = setInterval(() => {
          if (updatesSent >= UPDATES_PER_CLIENT) {
            clearInterval(interval)
            const updatesMs = performance.now() - updatesStart
            ws.close()
            resolve({ connectMs, updatesMs })
            return
          }
          ws.send(encodeAwarenessUpdate(clientIdx + 100, Math.random() * 1000, Math.random() * 1000))
          updatesSent++
        }, 10)
      }
    }

    ws.onerror = (e) => reject(new Error(`client ${clientIdx} error: ${String(e)}`))

    // Timeout safety
    setTimeout(() => {
      if (!synced) {
        ws.close()
        reject(new Error(`client ${clientIdx} timed out after 10s`))
      }
    }, 10_000)

    void t1
  })
}

async function fetchMetrics(): Promise<string> {
  const res = await fetch(`${WS_URL.replace('ws://', 'http://').replace('wss://', 'https://')}/metrics`)
  return res.text()
}

async function main() {
  console.log(`\n=== WS load harness: ${CLIENT_COUNT} clients × ${UPDATES_PER_CLIENT} awareness updates ===`)
  console.log(`Server: ${WS_URL}\n`)

  // Health check
  try {
    const health = await fetch(`${WS_URL.replace('ws://', 'http://').replace('wss://', 'https://')}/health`)
    const body = await health.json() as { ok: boolean }
    if (!body.ok) throw new Error('health check failed')
    console.log('✓ Server health check passed\n')
  } catch (e) {
    console.error('✗ Server not reachable. Start the server first: pnpm --filter @canvas-draw/server dev')
    process.exit(1)
  }

  const t0 = performance.now()
  const results = await Promise.all(
    Array.from({ length: CLIENT_COUNT }, (_, i) => runClient(i)),
  )
  const totalMs = performance.now() - t0

  const connectTimes = results.map((r) => r.connectMs).sort((a, b) => a - b)
  const updatesTimes = results.map((r) => r.updatesMs).sort((a, b) => a - b)

  const p50 = (arr: number[]) => arr[Math.floor(arr.length * 0.5)]!
  const p95 = (arr: number[]) => arr[Math.floor(arr.length * 0.95)]!
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length

  console.log('Connection time (ms):')
  console.log(`  avg=${avg(connectTimes).toFixed(1)}  p50=${p50(connectTimes).toFixed(1)}  p95=${p95(connectTimes).toFixed(1)}`)
  console.log('Awareness updates time (ms, for all updates per client):')
  console.log(`  avg=${avg(updatesTimes).toFixed(1)}  p50=${p50(updatesTimes).toFixed(1)}  p95=${p95(updatesTimes).toFixed(1)}`)
  console.log(`Total wall time: ${totalMs.toFixed(0)}ms`)
  console.log(`Throughput: ${(CLIENT_COUNT * UPDATES_PER_CLIENT / (totalMs / 1000)).toFixed(0)} msgs/sec\n`)

  // Print key metrics from server
  try {
    const metrics = await fetchMetrics()
    const extract = (name: string) => {
      const m = new RegExp(`^${name}\\s+(\\S+)`, 'm').exec(metrics)
      return m ? m[1] : 'n/a'
    }
    console.log('Server metrics after test:')
    console.log(`  ws_messages_received_total:    ${extract('ws_messages_received_total')}`)
    console.log(`  ws_awareness_messages_total:   ${extract('ws_awareness_messages_total')}`)
    console.log(`  ws_backpressure_drops_total:   ${extract('ws_backpressure_drops_total')}`)
    console.log(`  ws_rate_limit_exceeded_total:  ${extract('ws_rate_limit_exceeded_total')}`)
    console.log(`  ws_message_errors_total:       ${extract('ws_message_errors_total')}`)
  } catch {
    console.log('(Could not read /metrics)')
  }

  console.log('\nDone. Record these numbers in docs/PERF_BASELINE.md.')
}

main().catch((e) => { console.error(e); process.exit(1) })
