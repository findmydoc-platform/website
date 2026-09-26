import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import scheduler from '../../apps/preview-email-scheduler/api/tick'

const secret = 'synthetic-preview-scheduler-secret-only'
const endpoint = 'https://scheduler.example.test/api/tick'
const previewWorker = 'https://preview.findmydoc.eu/api/internal/transactional-email/worker'
const productionWorker = 'https://findmydoc.eu/api/internal/transactional-email/worker'
const request = (suffix = '') => new Request(`${endpoint}${suffix}`, { headers: { authorization: `Bearer ${secret}` } })

describe('Preview-owned email scheduler request', () => {
  const fetch = vi.fn()

  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', secret)
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('SCHEDULER_ENVIRONMENT', 'preview')
    vi.stubEnv('PREVIEW_WORKER_URL', previewWorker)
    vi.stubGlobal('fetch', fetch)
    fetch.mockResolvedValue(new Response(null, { status: 200 }))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  })

  it.each([
    new Request(endpoint),
    new Request(endpoint, { headers: { authorization: 'Bearer incorrect' } }),
    new Request(`${endpoint}?secret=${secret}`),
    new Request(endpoint, { headers: { cookie: `CRON_SECRET=${secret}` } }),
    new Request(endpoint, { method: 'POST', body: secret }),
  ])('rejects misplaced or incorrect credentials before making a request', async (unauthorized) => {
    expect((await scheduler.fetch(unauthorized)).status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['', 'too-short'])('fails closed for unusable configured secrets', async (configured) => {
    vi.stubEnv('CRON_SECRET', configured)
    expect((await scheduler.fetch(request())).status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['development', 'preview', 'test', 'ci', ''])('does not relay from the %s deployment', async (target) => {
    vi.stubEnv('VERCEL_ENV', target)
    expect((await scheduler.fetch(request())).status).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['production', '', 'local'])('refuses the %s logical environment', async (environment) => {
    vi.stubEnv('SCHEDULER_ENVIRONMENT', environment)
    expect((await scheduler.fetch(request())).status).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([productionWorker, `${previewWorker}?secret=value`, 'https://example.test/worker', ''])(
    'rejects a worker target outside the fixed Preview endpoint',
    async (target) => {
      vi.stubEnv('PREVIEW_WORKER_URL', target)
      expect((await scheduler.fetch(request())).status).toBe(503)
      expect(fetch).not.toHaveBeenCalled()
    },
  )

  it('invokes only the Preview worker once with its own credential and no redirect following', async () => {
    const response = await scheduler.fetch(request(`?target=${encodeURIComponent(productionWorker)}`))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(fetch).toHaveBeenCalledExactlyOnceWith(previewWorker, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
      redirect: 'error',
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    })
    expect(await response.json()).toEqual({ ok: true })
  })

  it.each([301, 302, 401, 403, 500, 503])(
    'reports upstream status %s without retry or response disclosure',
    async (status) => {
      fetch.mockResolvedValue(new Response('private upstream response', { status }))
      const response = await scheduler.fetch(request())
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ ok: false })
      expect(fetch).toHaveBeenCalledTimes(1)
    },
  )

  it('reports transport failure without retry or error disclosure', async () => {
    fetch.mockRejectedValue(new Error('private transport diagnostic'))
    const response = await scheduler.fetch(request())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ ok: false })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each(['POST', 'HEAD', 'PUT', 'DELETE'])('never relays an authenticated %s request', async (method) => {
    const response = await scheduler.fetch(
      new Request(endpoint, { method, headers: { authorization: `Bearer ${secret}` } }),
    )
    expect(response.status).toBe(405)
    expect(fetch).not.toHaveBeenCalled()
  })
})
