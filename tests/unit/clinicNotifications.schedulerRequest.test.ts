import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as production, POST } from '@/app/api/internal/clinic-notifications/retention/route'
import { GET as preview } from '@/app/api/internal/clinic-notifications/preview-retention/route'
const getPayload = vi.hoisted(() => vi.fn())
vi.mock('payload', async (load) => ({ ...(await load<typeof import('payload')>()), getPayload }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/posthog/api', () => ({ sendPostHogException: vi.fn() }))
const secret = 'synthetic-notification-scheduler-secret-only'
const request = (headers: HeadersInit = { authorization: `Bearer ${secret}` }) =>
  new Request('https://example.test/api/internal/clinic-notifications/retention', { headers })
beforeEach(() => {
  vi.stubEnv('CRON_SECRET', secret)
  vi.stubEnv('PREVIEW_NOTIFICATION_RETENTION_SECRET', secret)
  vi.stubEnv('VERCEL_ENV', 'production')
  vi.stubEnv('DEPLOYMENT_ENV', 'production')
  getPayload.mockRejectedValue(new Error('Synthetic storage initialization failure'))
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})
describe('independent notification retention scheduling boundary', () => {
  it('rejects missing credentials before resolving retention', async () => {
    expect((await production(request({}))).status).toBe(401)
    expect(getPayload).not.toHaveBeenCalled()
  })
  it('rejects unusable and misplaced credentials', async () => {
    vi.stubEnv('CRON_SECRET', 'short')
    expect((await production(request())).status).toBe(401)
    expect(getPayload).not.toHaveBeenCalled()
  })
  it('authenticates Production scheduling and contains storage initialization failure', async () => {
    const response = await production(request())
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(getPayload).toHaveBeenCalledTimes(1)
    expect(await response.json()).toEqual({ ok: false })
  })
  it('rejects authenticated writes', async () => {
    expect((await POST(request())).status).toBe(405)
    expect(getPayload).not.toHaveBeenCalled()
  })
  it('refuses Preview on the Production path before retention', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    expect((await production(request())).status).toBe(503)
    expect(getPayload).not.toHaveBeenCalled()
  })
  it('refuses logical environment drift', async () => {
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    expect((await production(request())).status).toBe(503)
    expect(getPayload).not.toHaveBeenCalled()
  })
  it('accepts only Preview on its separate credential path', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    expect((await preview(request())).status).toBe(503)
    expect(getPayload).toHaveBeenCalledTimes(1)
  })
})
