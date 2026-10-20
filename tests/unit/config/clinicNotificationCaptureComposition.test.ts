import type { PayloadRequest, SanitizedConfig } from 'payload'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { activateHostedCapture } from '@/features/clinicNotifications/hostedCapture'

vi.mock('@/posthog/api', () => ({ sendPostHogException: vi.fn() }))
vi.mock('@/features/clinicNotifications/hostedCapture', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/clinicNotifications/hostedCapture')>()
  return { ...actual, activateHostedCapture: vi.fn() }
})

const origin = 'https://preview.findmydoc.eu'
const input = {
  action: 'activate',
  environment: 'preview',
  runtimeRevision: 'a'.repeat(40),
  expectedState: 'b'.repeat(64),
}

describe('capture endpoint in the composed Payload configuration', () => {
  let config: SanitizedConfig

  beforeAll(async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', origin)
    const { default: actualConfig } = await import('@/payload.config')
    config = await actualConfig
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', origin)
    vi.mocked(activateHostedCapture).mockResolvedValue({
      environment: 'preview',
      runtimeRevision: input.runtimeRevision,
      contractVersion: 'clinic-notifications-v1',
      expectedState: input.expectedState,
      active: true,
      activatedAt: '2026-10-20T12:00:00.000Z',
      outcome: 'activated',
    })
  })

  afterEach(() => vi.unstubAllEnvs())

  function request(requestOrigin = origin, headerOrigin = requestOrigin) {
    return Object.assign(
      new Request(`${requestOrigin}/api/internal/clinic-notifications/capture`, {
        method: 'POST',
        headers: { Origin: headerOrigin, 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
      {
        user: { id: 11, collection: 'platformStaff' },
        context: {},
        payload: {
          config,
          find: vi.fn(async () => ({ docs: [{ id: 11, role: 'support' }] })),
          logger: { info: vi.fn(), error: vi.fn() },
        },
      },
    ) as unknown as PayloadRequest
  }

  it('submits the same-origin command through the actual configured endpoint without injecting serverURL', async () => {
    const endpoint = config.endpoints.find(
      ({ path, method }) => path === '/internal/clinic-notifications/capture' && method === 'post',
    )!
    const req = request()
    const response = await endpoint.handler(req)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ outcome: 'activated', active: true })
    expect(activateHostedCapture).toHaveBeenCalledExactlyOnceWith(req, input)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it.each([
    { label: 'foreign Origin', configured: origin, target: origin, header: 'https://foreign.example.test' },
    { label: 'foreign request URL', configured: origin, target: 'https://foreign.example.test', header: origin },
    {
      label: 'matching HTTP origins',
      configured: 'http://preview.findmydoc.eu',
      target: 'http://preview.findmydoc.eu',
      header: 'http://preview.findmydoc.eu',
    },
  ])('rejects $label with the composed configuration before submission', async ({ configured, target, header }) => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', configured)
    const endpoint = config.endpoints.find(
      ({ path, method }) => path === '/internal/clinic-notifications/capture' && method === 'post',
    )!
    const response = await endpoint.handler(request(target, header))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: { code: 'CAPTURE_ACCESS_DENIED' },
      writeOutcome: 'not_committed',
    })
    expect(activateHostedCapture).not.toHaveBeenCalled()
  })
})
