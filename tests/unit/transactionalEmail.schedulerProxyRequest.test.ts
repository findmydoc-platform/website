import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
  getPayload: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: mocks.getPayload,
}))

import { proxy } from '@/proxy'
import { GET, HEAD, POST } from '@/app/api/internal/transactional-email/worker/route'

const endpoint = 'https://preview.findmydoc.eu/api/internal/transactional-email/worker'
const secret = 'synthetic-preview-scheduler-proxy-secret'

async function requestThroughProxy(request: NextRequest, handler: typeof GET = GET) {
  const response = await proxy(request)
  if (response.headers.get('x-middleware-next') !== '1') return response

  const headers = new Headers()
  const forwardedNames = response.headers.get('x-middleware-override-headers')?.split(',') ?? []
  for (const name of forwardedNames) {
    const value = response.headers.get(`x-middleware-request-${name}`)
    if (value !== null) headers.set(name, value)
  }
  return handler(new Request(request.url, { method: request.method, headers }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VERCEL_ENV', 'preview')
  vi.stubEnv('DEPLOYMENT_ENV', 'preview')
  vi.stubEnv('CRON_SECRET', secret)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-anon-key')
  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser } })
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
  mocks.getPayload.mockRejectedValue(new Error('Unexpected database initialization'))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Preview scheduler request through the proxy and worker', () => {
  it('authenticates the scheduler at the worker while hosted processing remains closed', async () => {
    const response = await requestThroughProxy(
      new NextRequest(endpoint, { headers: { authorization: `Bearer ${secret}` } }),
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ ok: false })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.createServerClient).not.toHaveBeenCalled()
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.getPayload).not.toHaveBeenCalled()
  })

  const rejectedCredentials: { name: string; suffix?: string; headers?: HeadersInit }[] = [
    { name: 'missing credentials' },
    { name: 'incorrect bearer credentials', headers: { authorization: 'Bearer wrong' } },
    { name: 'query-only credentials', suffix: `?secret=${secret}` },
    { name: 'cookie-only credentials', headers: { cookie: `CRON_SECRET=${secret}` } },
  ]

  it.each(rejectedCredentials)('rejects $name at the worker without user lookup', async ({ suffix, headers }) => {
    const response = await requestThroughProxy(new NextRequest(`${endpoint}${suffix ?? ''}`, { headers }))

    expect(response.status).toBe(401)
    await expect(response.text()).resolves.toBe('')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.createServerClient).not.toHaveBeenCalled()
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.getPayload).not.toHaveBeenCalled()
  })

  it.each([
    { method: 'POST', handler: POST },
    { method: 'HEAD', handler: HEAD },
  ])('rejects authenticated $method requests without processing work', async ({ method, handler }) => {
    const response = await requestThroughProxy(
      new NextRequest(endpoint, { method, headers: { authorization: `Bearer ${secret}` } }),
      handler,
    )

    expect(response.status).toBe(405)
    await expect(response.text()).resolves.toBe('')
    expect(mocks.createServerClient).not.toHaveBeenCalled()
    expect(mocks.getPayload).not.toHaveBeenCalled()
  })

  it.each([
    '/api/internal/transactional-email',
    '/api/internal/transactional-email/worker/extra',
    '/api/internal/transactional-email/worker-other',
  ])('keeps the Preview guard on neighboring path %s', async (path) => {
    const response = await proxy(new NextRequest(`https://preview.findmydoc.eu${path}`))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(response.headers.get('x-middleware-next')).toBeNull()
    expect(mocks.getPayload).not.toHaveBeenCalled()
  })
})
