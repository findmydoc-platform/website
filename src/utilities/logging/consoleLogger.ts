import type { ServerLogger } from './shared'

export const fallbackConsoleLogger: ServerLogger = {
  debug: console.debug.bind(console),
  error: console.error.bind(console),
  fatal: console.error.bind(console),
  info: console.info.bind(console),
  level: 'error',
  trace: console.trace.bind(console),
  warn: console.warn.bind(console),
}
