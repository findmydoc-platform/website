import crypto from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'

const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const

type LogLevel = (typeof LOG_LEVELS)[number]
type LogValue = Error | Record<string, unknown> | string | undefined
type HeaderLike = Pick<Headers, 'get'>
type RequestLike = Pick<Request, 'method' | 'url'> | null | undefined
type ReqLike = Partial<PayloadRequest> | null | undefined

export type ServerLogger = Pick<
  Payload['logger'],
  'debug' | 'error' | 'fatal' | 'info' | 'level' | 'trace' | 'warn'
> & {
  child?: (bindings: Record<string, unknown>) => ServerLogger
}

export type ScopedLogger = ServerLogger & {
  child: (bindings: Record<string, unknown>) => ScopedLogger
}

export type RequestLogContext = {
  deploymentEnv: string
  method?: string
  path?: string
  requestId?: string
  vercelId?: string
}

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

const readHeader = (headers: HeaderLike | null | undefined, name: string): string | undefined => {
  const value = headers?.get(name)
  return normalizeString(value)
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

export const getDeploymentEnv = (env: Partial<NodeJS.ProcessEnv> = process.env): string => {
  const vercelEnv = normalizeString(env.VERCEL_ENV)?.toLowerCase()
  if (vercelEnv) return vercelEnv

  const deploymentEnv = normalizeString(env.DEPLOYMENT_ENV)?.toLowerCase()
  if (deploymentEnv) return deploymentEnv

  const nodeEnv = normalizeString(env.NODE_ENV)?.toLowerCase()
  if (nodeEnv) return nodeEnv

  return 'unknown'
}

export const hashLogValue = (value: string): string => {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 12)
}

export const isLogLevel = (value: string | undefined): value is LogLevel => {
  return Boolean(value && LOG_LEVELS.includes(value as LogLevel))
}

export const getRequestLogContext = ({
  headers,
  req,
  request,
}: {
  headers?: HeaderLike | null
  req?: ReqLike
  request?: RequestLike
} = {}): RequestLogContext => {
  const reqRecord = toRecord(req)
  const requestId =
    normalizeString(reqRecord?.id) ??
    normalizeString(reqRecord?.transactionID) ??
    normalizeString(toRecord(reqRecord?.context)?.id) ??
    readHeader(headers, 'x-request-id') ??
    readHeader(headers, 'x-correlation-id')

  const vercelId = readHeader(headers, 'x-vercel-id')
  const method =
    normalizeString(reqRecord?.method) ??
    normalizeString(request?.method)?.toUpperCase() ??
    readHeader(headers, 'x-http-method-override')

  const pathFromReq = normalizeString(reqRecord?.path) ?? normalizeString(reqRecord?.pathname)

  let path = pathFromReq
  if (!path) {
    const requestUrl = normalizeString(reqRecord?.url) ?? normalizeString(request?.url)
    if (requestUrl) {
      try {
        path = new URL(requestUrl, 'http://localhost').pathname
      } catch {
        path = requestUrl
      }
    }
  }

  return {
    deploymentEnv: getDeploymentEnv(),
    ...(method ? { method } : {}),
    ...(path ? { path } : {}),
    ...(requestId ? { requestId } : {}),
    ...(vercelId ? { vercelId } : {}),
  }
}

const mergeBindings = (base: Record<string, unknown>, payload?: Record<string, unknown>) => {
  return payload ? { ...base, ...payload } : { ...base }
}

const invokeLog = (
  logger: ServerLogger,
  level: LogLevel,
  bindings: Record<string, unknown>,
  value?: LogValue,
  message?: string,
) => {
  const logMethod =
    typeof logger[level] === 'function'
      ? logger[level].bind(logger)
      : typeof logger.info === 'function'
        ? logger.info.bind(logger)
        : () => undefined

  if (value instanceof Error) {
    logMethod({ ...bindings, err: value }, message)
    return
  }

  if (typeof value === 'string') {
    logMethod(bindings, value)
    return
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    logMethod(mergeBindings(bindings, value), message)
    return
  }

  if (message) {
    logMethod(bindings, message)
    return
  }

  logMethod(bindings)
}

export const createScopedLogger = (logger: ServerLogger, bindings: Record<string, unknown> = {}): ScopedLogger => {
  const baseBindings = { ...bindings }

  const scopedLogger = {
    level: logger.level,
    trace: (value?: LogValue, message?: string) => invokeLog(logger, 'trace', baseBindings, value, message),
    debug: (value?: LogValue, message?: string) => invokeLog(logger, 'debug', baseBindings, value, message),
    info: (value?: LogValue, message?: string) => invokeLog(logger, 'info', baseBindings, value, message),
    warn: (value?: LogValue, message?: string) => invokeLog(logger, 'warn', baseBindings, value, message),
    error: (value?: LogValue, message?: string) => invokeLog(logger, 'error', baseBindings, value, message),
    fatal: (value?: LogValue, message?: string) => invokeLog(logger, 'fatal', baseBindings, value, message),
    child: (childBindings: Record<string, unknown>) =>
      createScopedLogger(logger, {
        ...baseBindings,
        ...childBindings,
      }),
  } satisfies ScopedLogger

  return scopedLogger
}
