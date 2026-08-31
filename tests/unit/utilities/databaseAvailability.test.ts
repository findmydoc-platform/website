import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const telemetryMocks = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => Promise<void> | void>,
  sendPostHogException: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/server.js', () => ({
  after: vi.fn((callback: () => Promise<void> | void) => {
    telemetryMocks.afterCallbacks.push(callback)
  }),
}))

vi.mock('@/posthog/api', () => ({
  sendPostHogException: telemetryMocks.sendPostHogException,
}))

import {
  DATABASE_TEMPORARILY_UNAVAILABLE_CODE,
  classifyDatabaseAvailabilityError,
  payloadDatabaseAvailabilityAfterError,
} from '@/features/databaseAvailability'

const createLogger = () => ({
  debug: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  info: vi.fn(),
  level: 'info',
  trace: vi.fn(),
  warn: vi.fn(),
})

const createPayloadRequest = (logger: ReturnType<typeof createLogger>): PayloadRequest => {
  const request = new Request('https://preview.findmydoc.eu/api/posts', {
    headers: { 'x-vercel-id': 'fra1::request-1' },
  })

  return Object.assign(request, {
    payload: { logger },
    responseHeaders: new Headers(),
  }) as unknown as PayloadRequest
}

describe('database availability contract', () => {
  beforeEach(() => {
    telemetryMocks.afterCallbacks.length = 0
    telemetryMocks.sendPostHogException.mockClear()
  })

  it('classifies connection limits and acquisition timeouts across wrapped errors', () => {
    const connectionLimit = Object.assign(new Error('pool rejected client'), { code: 'EMAXCONN' })
    const acquisitionTimeout = new Error('Error: cannot connect to Postgres', {
      cause: new Error('timeout exceeded when trying to connect'),
    })

    expect(classifyDatabaseAvailabilityError(connectionLimit)).toEqual({
      kind: 'connection-limit',
      sourceCode: 'EMAXCONN',
    })
    expect(classifyDatabaseAvailabilityError(acquisitionTimeout)).toEqual({
      kind: 'connection-timeout',
    })
  })

  it.each(['EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND'])(
    'classifies temporary network code %s as connection unavailable',
    (code) => {
      expect(classifyDatabaseAvailabilityError(Object.assign(new Error('network unavailable'), { code }))).toEqual({
        kind: 'connection-unavailable',
        sourceCode: code,
      })
    },
  )

  it('does not classify application or authentication failures as database availability errors', () => {
    expect(classifyDatabaseAvailabilityError(new Error('Access denied for clinic principal'))).toBeNull()
    expect(classifyDatabaseAvailabilityError(Object.assign(new Error('duplicate value'), { code: '23505' }))).toBeNull()
  })

  it('maps an uncaught database limit to a stable 503 and schedules sanitized telemetry', async () => {
    const logger = createLogger()
    const req = createPayloadRequest(logger)
    const originalError = Object.assign(new Error('remaining connection slots contain secret-host.example.test'), {
      code: '53300',
    })

    const result = await payloadDatabaseAvailabilityAfterError({
      context: {},
      error: originalError,
      req,
      result: { errors: [{ message: 'Something went wrong.' }] },
    })

    expect(result).toEqual({
      response: { error: { code: DATABASE_TEMPORARILY_UNAVAILABLE_CODE } },
      status: 503,
    })
    expect(req.responseHeaders?.get('cache-control')).toBe('private, no-store')
    expect(req.responseHeaders?.get('vary')).toBe('Authorization')
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseFailureKind: 'connection-limit',
        databaseMode: 'transaction-pooler',
        event: 'database.runtime.connection_unavailable',
        phase: 'payload-request',
      }),
      'Payload database connection is temporarily unavailable',
    )

    const loggedContext = logger.error.mock.calls[0]?.[0] as { err?: Error }
    expect(loggedContext.err?.message).toBe('Payload database connection temporarily unavailable: connection-limit')
    expect(loggedContext.err?.message).not.toContain('secret-host')

    expect(telemetryMocks.afterCallbacks).toHaveLength(1)
    await telemetryMocks.afterCallbacks[0]?.()
    expect(telemetryMocks.sendPostHogException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Payload database connection temporarily unavailable: connection-limit',
        name: 'DatabaseRuntimeUnavailableError',
      }),
      expect.objectContaining({
        distinctId: 'server',
        method: 'GET',
        properties: {
          database_failure_kind: 'connection-limit',
          database_mode: 'transaction-pooler',
          event: 'database.runtime.connection_unavailable',
          phase: 'payload-request',
        },
      }),
    )
  })

  it('maps a wrapped GraphQL database failure to the stable GraphQL error contract', async () => {
    const logger = createLogger()
    const req = createPayloadRequest(logger)
    const originalError = Object.assign(new Error('remaining connection slots'), { code: '53300' })
    const graphqlError = Object.assign(new Error('resolver failed'), {
      originalError,
    })

    const result = await payloadDatabaseAvailabilityAfterError({
      context: {},
      error: graphqlError,
      graphqlResult: {
        extensions: { data: { internal: true }, statusCode: 500 },
        locations: [{ column: 3, line: 2 }],
        message: 'Something went wrong.',
        path: ['Posts'],
      },
      req,
    })

    expect(result).toEqual({
      graphqlResult: {
        extensions: {
          code: DATABASE_TEMPORARILY_UNAVAILABLE_CODE,
          statusCode: 503,
        },
        locations: [{ column: 3, line: 2 }],
        message: 'Database temporarily unavailable',
        path: ['Posts'],
      },
    })
    expect(req.responseHeaders?.get('cache-control')).toBe('private, no-store')
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        databaseFailureKind: 'connection-limit',
        phase: 'payload-request',
      }),
      'Payload database connection is temporarily unavailable',
    )
  })

  it('leaves unrelated Payload errors unchanged', async () => {
    const logger = createLogger()
    const req = createPayloadRequest(logger)

    expect(
      payloadDatabaseAvailabilityAfterError({
        context: {},
        error: new Error('Validation failed'),
        req,
        result: { errors: [{ message: 'Validation failed' }] },
      }),
    ).toBeUndefined()

    expect(logger.error).not.toHaveBeenCalled()
    expect(telemetryMocks.afterCallbacks).toHaveLength(0)
  })
})
