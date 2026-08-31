import { after } from 'next/server.js'
import type { AfterErrorHook } from 'payload'

import { sendPostHogException } from '@/posthog/api'
import { fallbackConsoleLogger } from '@/utilities/logging/consoleLogger'
import { createScopedLogger, getRequestLogContext, type ServerLogger } from '@/utilities/logging/shared'

export const DATABASE_TEMPORARILY_UNAVAILABLE_CODE = 'DATABASE_TEMPORARILY_UNAVAILABLE'

const DATABASE_TEMPORARILY_UNAVAILABLE_MESSAGE = 'Database temporarily unavailable'

export type DatabaseAvailabilityFailure = {
  kind: 'connection-limit' | 'connection-timeout' | 'connection-unavailable'
  sourceCode?: string
}

type ErrorRecord = {
  cause?: unknown
  code?: unknown
  err?: unknown
  message?: unknown
  originalError?: unknown
}

type RequestContextSource = Partial<Pick<Request, 'headers' | 'method' | 'url'>>

const CONNECTION_LIMIT_CODES = new Set(['53300', 'EMAXCONN'])
const CONNECTION_TIMEOUT_CODES = new Set(['ETIMEDOUT'])
const CONNECTION_UNAVAILABLE_CODES = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '08P01',
  '57P03',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
])

const CONNECTION_LIMIT_PATTERNS = [
  /EMAXCONN/iu,
  /max(?:imum)? client connections/iu,
  /remaining connection slots/iu,
  /too many (?:clients|connections)/iu,
]
const CONNECTION_TIMEOUT_PATTERNS = [
  /connection terminated due to connection timeout/iu,
  /timeout exceeded when trying to connect/iu,
  /timeout expired/iu,
]
const CONNECTION_UNAVAILABLE_PATTERNS = [
  /cannot connect now/iu,
  /database system is (?:in recovery mode|shutting down|starting up)/iu,
]

const classifyCode = (code: string): DatabaseAvailabilityFailure | null => {
  if (CONNECTION_LIMIT_CODES.has(code)) return { kind: 'connection-limit', sourceCode: code }
  if (CONNECTION_TIMEOUT_CODES.has(code)) return { kind: 'connection-timeout', sourceCode: code }
  if (CONNECTION_UNAVAILABLE_CODES.has(code)) return { kind: 'connection-unavailable', sourceCode: code }
  return null
}

const classifyMessage = (message: string): DatabaseAvailabilityFailure | null => {
  if (CONNECTION_LIMIT_PATTERNS.some((pattern) => pattern.test(message))) return { kind: 'connection-limit' }
  if (CONNECTION_TIMEOUT_PATTERNS.some((pattern) => pattern.test(message))) return { kind: 'connection-timeout' }
  if (CONNECTION_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(message))) {
    return { kind: 'connection-unavailable' }
  }
  return null
}

export const classifyDatabaseAvailabilityError = (error: unknown): DatabaseAvailabilityFailure | null => {
  const queue: unknown[] = [error]
  const visited = new Set<unknown>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current)) continue
    visited.add(current)

    if (typeof current === 'string') {
      const failure = classifyMessage(current)
      if (failure) return failure
      continue
    }

    if (typeof current !== 'object') continue
    const record = current as ErrorRecord
    if (typeof record.code === 'string') {
      const failure = classifyCode(record.code.toUpperCase())
      if (failure) return failure
    }
    if (typeof record.message === 'string') {
      const failure = classifyMessage(record.message)
      if (failure) return failure
    }

    if (record.cause) queue.push(record.cause)
    if (record.err) queue.push(record.err)
    if (record.originalError) queue.push(record.originalError)
  }

  return null
}

const createSafeDatabaseError = (failure: DatabaseAvailabilityFailure): Error => {
  const error = new Error(`Payload database connection temporarily unavailable: ${failure.kind}`)
  error.name = 'DatabaseRuntimeUnavailableError'
  return error
}

const applyPrivateUnavailableHeaders = (headers: Headers): void => {
  headers.set('Cache-Control', 'private, no-store')
  headers.set('Expires', '0')
  headers.set('Pragma', 'no-cache')
  headers.set('Vary', 'Authorization')
}

const createUnavailableHeaders = (): Headers => {
  const headers = new Headers()
  applyPrivateUnavailableHeaders(headers)
  return headers
}

export const databaseTemporarilyUnavailableResponse = (): Response =>
  Response.json(
    { error: { code: DATABASE_TEMPORARILY_UNAVAILABLE_CODE } },
    {
      headers: createUnavailableHeaders(),
      status: 503,
    },
  )

export const databaseTemporarilyUnavailableGraphqlResponse = (): Response =>
  Response.json(
    {
      errors: [
        {
          extensions: {
            code: DATABASE_TEMPORARILY_UNAVAILABLE_CODE,
            statusCode: 503,
          },
          message: DATABASE_TEMPORARILY_UNAVAILABLE_MESSAGE,
        },
      ],
    },
    {
      headers: createUnavailableHeaders(),
      status: 503,
    },
  )

export const reportDatabaseAvailabilityFailure = ({
  failure,
  logger = fallbackConsoleLogger,
  phase,
  req,
}: {
  failure: DatabaseAvailabilityFailure
  logger?: ServerLogger
  phase: 'payload-init' | 'payload-request'
  req?: RequestContextSource
}): void => {
  const request =
    typeof req?.method === 'string' && typeof req.url === 'string' ? { method: req.method, url: req.url } : undefined
  const requestContext = getRequestLogContext({ headers: req?.headers, request })
  const safeError = createSafeDatabaseError(failure)
  const scopedLogger = createScopedLogger(logger, {
    component: 'database-runtime',
    scope: 'database.runtime',
  })

  scopedLogger.error(
    {
      ...requestContext,
      databaseFailureKind: failure.kind,
      databaseMode: 'transaction-pooler',
      err: safeError,
      event: 'database.runtime.connection_unavailable',
      phase,
      ...(failure.sourceCode ? { sourceCode: failure.sourceCode } : {}),
    },
    'Payload database connection is temporarily unavailable',
  )

  const capture = () =>
    sendPostHogException(safeError, {
      distinctId: 'server',
      ...(requestContext.method ? { method: requestContext.method } : {}),
      properties: {
        database_failure_kind: failure.kind,
        database_mode: 'transaction-pooler',
        event: 'database.runtime.connection_unavailable',
        phase,
      },
    })

  try {
    after(capture)
  } catch {
    void capture()
  }
}

export const payloadDatabaseAvailabilityAfterError: AfterErrorHook = ({ error, graphqlResult, req }) => {
  const failure = classifyDatabaseAvailabilityError(error)
  if (!failure) return

  reportDatabaseAvailabilityFailure({
    failure,
    logger: req.payload.logger,
    phase: 'payload-request',
    req,
  })

  req.responseHeaders ??= new Headers()
  applyPrivateUnavailableHeaders(req.responseHeaders)

  if (graphqlResult) {
    return {
      graphqlResult: {
        extensions: {
          code: DATABASE_TEMPORARILY_UNAVAILABLE_CODE,
          statusCode: 503,
        },
        ...(graphqlResult.locations ? { locations: graphqlResult.locations } : {}),
        message: DATABASE_TEMPORARILY_UNAVAILABLE_MESSAGE,
        ...(graphqlResult.path ? { path: graphqlResult.path } : {}),
      },
    }
  }

  return {
    response: { error: { code: DATABASE_TEMPORARILY_UNAVAILABLE_CODE } },
    status: 503,
  }
}
