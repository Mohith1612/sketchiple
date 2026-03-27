import uWS from 'uWebSockets.js'
import { attachWebSocketHandler } from './ws/handler.js'
import { renderPrometheusMetrics, setGauge } from './metrics/metrics.js'
import { logger } from './utils/logger.js'

const PORT = Number(process.env.PORT ?? 3001)

const app = uWS.App()

setGauge('rooms_active', 0)
setGauge('ws_active_sockets', 0)

attachWebSocketHandler(app)

// Health check endpoint
app.get('/health', (res) => {
  res.writeHeader('Content-Type', 'application/json').end(JSON.stringify({ ok: true }))
})

// Prometheus-style metrics endpoint
app.get('/metrics', (res) => {
  res
    .writeHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
    .end(renderPrometheusMetrics())
})

app.listen(PORT, (token) => {
  if (token) {
    logger.info('server listening', { port: PORT })
  } else {
    logger.error('failed to bind port', { port: PORT })
    process.exit(1)
  }
})
