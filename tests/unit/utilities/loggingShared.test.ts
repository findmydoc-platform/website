import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createScopedLogger,
  getDeploymentEnv,
  getRequestLogContext,
  hashLogValue,
  toLoggedError,
} from '@/utilities/logging/shared'

describe('logging shared utilities', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers VERCEL_ENV over NODE_ENV', () => {
    expect(getDeploymentEnv({ NODE_ENV: 'development', VERCEL_ENV: 'preview' })).toBe('preview')
  })

  it('extracts request context from headers and request objects', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')

    const headers = new Headers({
      'x-request-id': 'req-123',
      'x-vercel-id': 'fra1::abc123',
    })

    const context = getRequestLogContext({
      headers,
      request: new Request('https://example.com/api/auth/login?next=/admin', {
        method: 'POST',
        headers,
      }),
    })

    expect(context).toEqual({
      deploymentEnv: 'preview',
      method: 'POST',
      path: '/api/auth/login',
      requestId: 'req-123',
      vercelId: 'fra1::abc123',
    })
  })

  it('hashes values deterministically without exposing the source string', () => {
    expect(hashLogValue(' Admin@Example.com ')).toBe(hashLogValue('admin@example.com'))
    expect(hashLogValue('admin@example.com')).toHaveLength(12)
    expect(hashLogValue('admin@example.com')).not.toContain('admin@example.com')
  })

  it('normalizes unknown values to Error instances for structured logging', () => {
    expect(toLoggedError(new Error('boom'))).toBeInstanceOf(Error)
    expect(toLoggedError({ message: 'payload failed' }).message).toBe('payload failed')
    expect(toLoggedError('plain failure').message).toBe('plain failure')
  })

  it('prefers the native child logger when available', () => {
    const childInfo = vi.fn()
    const nativeChild = vi.fn(() => ({
      child: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: childInfo,
      level: 'info',
      trace: vi.fn(),
      warn: vi.fn(),
    }))

    const logger = {
      child: nativeChild,
      debug: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: vi.fn(),
      level: 'info',
      trace: vi.fn(),
      warn: vi.fn(),
    }

    const scopedLogger = createScopedLogger(logger, { scope: 'auth.supabase' })
    scopedLogger.info('native child logger works')

    expect(nativeChild).toHaveBeenCalledWith({ scope: 'auth.supabase' })
    expect(childInfo).toHaveBeenCalledWith('native child logger works')
  })

  it('supports nested native child loggers without recursive child overrides', () => {
    const leafInfo = vi.fn()
    const leafLogger = {
      child: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: leafInfo,
      level: 'info',
      trace: vi.fn(),
      warn: vi.fn(),
    }

    const middleLogger = {
      child: vi.fn(() => leafLogger),
      debug: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: vi.fn(),
      level: 'info',
      trace: vi.fn(),
      warn: vi.fn(),
    }

    const logger = {
      child: vi.fn(() => middleLogger),
      debug: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: vi.fn(),
      level: 'info',
      trace: vi.fn(),
      warn: vi.fn(),
    }

    const scopedLogger = createScopedLogger(logger, { scope: 'auth.supabase' })
    const nestedLogger = scopedLogger.child({ component: 'login-route' })

    nestedLogger.info({ event: 'auth.supabase.authenticate.start' }, 'Nested logger works')

    expect(logger.child).toHaveBeenCalledWith({ scope: 'auth.supabase' })
    expect(middleLogger.child).toHaveBeenCalledWith({ component: 'login-route' })
    expect(leafInfo).toHaveBeenCalledWith({ event: 'auth.supabase.authenticate.start' }, 'Nested logger works')
  })
})
