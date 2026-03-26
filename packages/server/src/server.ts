import uWS from 'uWebSockets.js'
import { attachWebSocketHandler } from './ws/handler.js'
import { logger } from './utils/logger.js'

const PORT = Number(process.env.PORT ?? 3001)

const app = uWS.App()

attachWebSocketHandler(app)

app.get('/health', (res) => {
  res.writeHeader('Content-Type', 'application/json').end(JSON.stringify({ ok: true }))
})

app.listen(PORT, (token) => {
  if (token) {
    logger.info('server listening', { port: PORT })
  } else {
    logger.error('failed to bind port', { port: PORT })
    process.exit(1)
  }
})
