type LogData = Record<string, unknown>

function fmt(level: string, msg: string, data?: LogData): string {
  const ts = new Date().toISOString()
  const suffix = data && Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : ''
  return `${ts} [${level}] ${msg}${suffix}`
}

export const logger = {
  info: (msg: string, data?: LogData) => console.log(fmt('info', msg, data)),
  warn: (msg: string, data?: LogData) => console.warn(fmt('warn', msg, data)),
  error: (msg: string, data?: LogData) => console.error(fmt('error', msg, data)),
}
