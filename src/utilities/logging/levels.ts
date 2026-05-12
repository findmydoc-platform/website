export const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const

export type LogLevel = (typeof LOG_LEVELS)[number]

export const normalizeLogLevel = (value: string | undefined): LogLevel | null => {
  if (typeof value !== 'string') return null

  const normalized = value.trim().toLowerCase()
  return LOG_LEVELS.includes(normalized as LogLevel) ? (normalized as LogLevel) : null
}

export const isLogLevel = (value: string | undefined): value is LogLevel => {
  return Boolean(value && LOG_LEVELS.includes(value as LogLevel))
}
