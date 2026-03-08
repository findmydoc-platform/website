import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDeploymentEnv, getRequestLogContext, hashLogValue } from '@/utilities/logging/shared'

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
})
