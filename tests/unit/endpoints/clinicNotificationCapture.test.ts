import type { PayloadRequest } from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clinicNotificationCaptureGetHandler,
  clinicNotificationCapturePostHandler,
} from '@/endpoints/clinicNotificationCapture'
import { activateHostedCapture } from '@/features/clinicNotifications/hostedCapture'

vi.mock('@/posthog/api', () => ({ sendPostHogException: vi.fn() }))
vi.mock('@/features/clinicNotifications/hostedCapture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/clinicNotifications/hostedCapture')>()
  return { ...actual, activateHostedCapture: vi.fn(actual.activateHostedCapture) }
})

function request(role = 'admin', body?: unknown) {
  const web = new Request('https://example.com/api/internal/clinic-notifications/capture', {
    method: body ? 'POST' : 'GET',
    headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return Object.assign(web, {
    user: { id: 11, collection: 'platformStaff' },
    context: {},
    payload: {
      config: { serverURL: 'https://example.com' },
      find: vi.fn(async ({ collection }) => ({
        docs: collection === 'platformStaff' ? (role === 'admin' ? [{ id: 11, role }] : []) : [],
      })),
      create: vi.fn(),
      update: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() },
    },
  }) as unknown as PayloadRequest
}

describe('hosted notification capture operator endpoint', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllEnvs())
  it('denies an unauthenticated prepare without reading or changing capture storage', async () => {
    const find = vi.fn()
    const response = await clinicNotificationCaptureGetHandler({
      user: null,
      headers: new Headers(),
      payload: { find, logger: { info: vi.fn(), error: vi.fn() } },
    } as unknown as PayloadRequest)
    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(find).not.toHaveBeenCalled()
  })

  it('prepares an inactive hosted boundary without creating it and rejects environment drift', async () => {
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'a'.repeat(40))
    const req = request()
    const response = await clinicNotificationCaptureGetHandler(req)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      environment: 'preview',
      active: false,
      activatedAt: null,
      expectedState: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(req.payload.create).not.toHaveBeenCalled()
    expect(req.payload.update).not.toHaveBeenCalled()
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    expect((await clinicNotificationCaptureGetHandler(req)).status).toBe(409)
  })

  it('rejects a cross-origin activation before submitting any native write', async () => {
    const req = request('admin', { action: 'activate' })
    req.headers.set('origin', 'https://foreign.example')
    expect((await clinicNotificationCapturePostHandler(req)).status).toBe(403)
    expect(req.payload.create).not.toHaveBeenCalled()
    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it.each(['clinicStaff', 'patients'])('denies %s without a platform-role lookup', async (collection) => {
    const req = request()
    req.user = { id: 11, collection } as PayloadRequest['user']
    expect((await clinicNotificationCaptureGetHandler(req)).status).toBe(403)
    expect(req.payload.find).not.toHaveBeenCalled()
  })

  it('uses the stored operator role rather than a stale authenticated admin claim', async () => {
    const req = request('content-manager')
    expect((await clinicNotificationCaptureGetHandler(req)).status).toBe(403)
    expect(req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'platformStaff',
        where: { and: [{ id: { equals: 11 } }, { role: { in: ['admin', 'support'] } }] },
      }),
    )
  })

  it.each([
    {
      action: 'activate',
      environment: 'preview',
      runtimeRevision: 'a'.repeat(40),
      expectedState: 'b'.repeat(64),
      activatedAt: '2020-01-01T00:00:00.000Z',
    },
    { action: 'deactivate', environment: 'preview', runtimeRevision: 'a'.repeat(40), expectedState: 'b'.repeat(64) },
    { action: 'activate', environment: 'preview' },
  ])('rejects open or incomplete activation input before native submission', async (body) => {
    const req = request('admin', body)
    const response = await clinicNotificationCapturePostHandler(req)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ writeOutcome: 'not_committed' })
    expect(req.payload.create).not.toHaveBeenCalled()
    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it('preserves the original activation time on an explicitly prepared active replay', async () => {
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'a'.repeat(40))
    const activatedAt = '2026-10-17T10:00:00.000Z'
    const req = request()
    vi.mocked(req.payload.find).mockImplementation(
      async ({ collection }) =>
        ({
          docs: collection === 'platformStaff' ? [{ id: 11, role: 'admin' }] : [{ id: 7, active: true, activatedAt }],
        }) as never,
    )
    const prepared = await (await clinicNotificationCaptureGetHandler(req)).json()
    const post = request('admin', {
      action: 'activate',
      environment: prepared.environment,
      runtimeRevision: prepared.runtimeRevision,
      expectedState: prepared.expectedState,
    })
    post.payload = req.payload
    const response = await clinicNotificationCapturePostHandler(post)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ outcome: 'already_active', activatedAt })
    expect(req.payload.create).not.toHaveBeenCalled()
    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it('rejects a different environment or revision as definitely unsubmitted', async () => {
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'a'.repeat(40))
    const req = request('admin', {
      action: 'activate',
      environment: 'production',
      runtimeRevision: 'a'.repeat(40),
      expectedState: 'b'.repeat(64),
    })
    const response = await clinicNotificationCapturePostHandler(req)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ writeOutcome: 'not_committed' })
    expect(req.payload.create).not.toHaveBeenCalled()
    expect(req.payload.update).not.toHaveBeenCalled()
  })

  it('reports unknown after a submitted failure without logging raw errors or automatically replaying', async () => {
    const req = request('admin', {
      action: 'activate',
      environment: 'preview',
      runtimeRevision: 'a'.repeat(40),
      expectedState: 'b'.repeat(64),
    })
    vi.mocked(activateHostedCapture).mockRejectedValueOnce(new Error('synthetic-private-native-cause'))
    const response = await clinicNotificationCapturePostHandler(req)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'CAPTURE_UNAVAILABLE' }, writeOutcome: 'unknown' })
    expect(activateHostedCapture).toHaveBeenCalledTimes(1)
    const diagnostic = vi.mocked(req.payload.logger.error).mock.calls
    expect(diagnostic[0]?.[0]).toMatchObject({
      operation: 'capture_activate',
      transactionOutcome: 'unknown',
      result: 'failure',
    })
    expect(JSON.stringify(diagnostic)).not.toContain('synthetic-private-native-cause')
  })

  it('keeps diagnostic sink failure separate from successful readonly preparation', async () => {
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'a'.repeat(40))
    const req = request()
    vi.mocked(req.payload.logger.info).mockImplementationOnce(() => {
      throw new Error('Synthetic diagnostic sink failure')
    })
    expect((await clinicNotificationCaptureGetHandler(req)).status).toBe(200)
    expect(req.payload.create).not.toHaveBeenCalled()
    expect(req.payload.update).not.toHaveBeenCalled()
  })
})
