import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { ClinicNotificationError } from '@/features/clinicNotifications/errors'
import {
  clinicDashboardNotificationsReadPostHandler,
  clinicDashboardNotificationsGetHandler,
} from '@/endpoints/clinicDashboardNotifications'

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), mark: vi.fn(), read: vi.fn() }))
vi.mock('@/features/clinicDashboard/bootstrap', () => ({ resolveClinicDashboardPrincipal: mocks.authorize }))
vi.mock('@/features/clinicNotifications/service', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  markClinicNotificationsRead: mocks.mark,
  readClinicNotifications: mocks.read,
}))

function request(body: string, headers?: Record<string, string | undefined>, chunked = false): PayloadRequest {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
  return Object.assign(
    new Request('http://localhost:3000/api/clinic-dashboard/notifications/read', {
      method: 'POST',
      body: chunked ? stream : body,
      duplex: 'half',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        'X-Findmydoc-Clinic-Notifications-Contract': 'clinic-notifications-v1',
        'X-Findmydoc-Clinic-Scope-Contract': 'clinic-scope-v1',
        ...Object.fromEntries(
          Object.entries(headers ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        ),
      },
    } as RequestInit),
    { payload: { logger: { info: vi.fn() } } },
  ) as unknown as PayloadRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CLINIC_DASHBOARD_URL = 'http://localhost:3000'
  mocks.authorize.mockResolvedValue({ status: 'success', principalId: 22 })
  mocks.mark.mockResolvedValue({
    contractVersion: 'clinic-notifications-v1',
    serverTime: '2026-10-14T09:00:01.000Z',
    acknowledged: true,
  })
  mocks.read.mockResolvedValue({
    contractVersion: 'clinic-notifications-v1',
    serverTime: '2026-10-14T09:00:01.000Z',
    mode: 'summary',
    unreadCount: 0,
    nextUnreadCountChangeAt: null,
  })
})

describe('authorized Website notification acknowledgement HTTP boundary', () => {
  it('passes only a fixed complete selection and returns the literal private acknowledgement', async () => {
    const response = await clinicDashboardNotificationsReadPostHandler(request('{"notificationIds":["one","two"]}'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      contractVersion: 'clinic-notifications-v1',
      serverTime: '2026-10-14T09:00:01.000Z',
      acknowledged: true,
    })
    expect(mocks.mark).toHaveBeenCalledWith(expect.anything(), { notificationIds: ['one', 'two'] })
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(response.headers.get('X-Findmydoc-Clinic-Notifications-Support')).toBe('clinic-notifications-v1')
    expect(response.headers.get('Vary')).toContain('X-Findmydoc-Clinic-Scope-Contract')
  })

  it.each([
    { headers: { Origin: 'https://foreign.example' }, body: '{"notificationIds":["one"]}', code: 'REQUEST_REJECTED' },
    { headers: {}, body: '{"notificationIds":["one"],"clinicStaff":"forged"}', code: 'INVALID_INPUT' },
    { headers: { 'X-Findmydoc-Clinic-Notifications-Contract': 'v2' }, body: '{}', code: 'CONTRACT_INCOMPATIBLE' },
  ])('proves noncommit for $code before any write', async ({ headers, body, code }) => {
    const response = await clinicDashboardNotificationsReadPostHandler(request(body, headers))
    expect(await response.json()).toMatchObject({ error: { code }, writeOutcome: 'not_committed' })
    expect(mocks.mark).not.toHaveBeenCalled()
  })

  it.each([
    { error: new ClinicNotificationError('SERVICE_UNAVAILABLE', 'not_committed'), outcome: 'not_committed' },
    { error: new Error('Synthetic protected raw upstream failure'), outcome: 'unknown' },
  ])('preserves $outcome instead of inferring rollback after command submission', async ({ error, outcome }) => {
    mocks.mark.mockRejectedValueOnce(error)
    const response = await clinicDashboardNotificationsReadPostHandler(request('{"notificationIds":["one"]}'))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      contractVersion: 'clinic-notifications-v1',
      error: { code: 'SERVICE_UNAVAILABLE' },
      writeOutcome: outcome,
    })
  })

  it('accepts a complete selection beyond database parameter-count limits as one command', async () => {
    const notificationIds = Array.from({ length: 70000 }, (_, index) => `notification-${index}`)
    const response = await clinicDashboardNotificationsReadPostHandler(request(JSON.stringify({ notificationIds })))
    expect(response.status).toBe(200)
    expect(mocks.mark).toHaveBeenCalledTimes(1)
    expect(mocks.mark).toHaveBeenCalledWith(expect.anything(), { notificationIds })
  })

  it('enforces exact four-MiB bytes including chunked whitespace without dropping or splitting members', async () => {
    const base = '{"notificationIds":["one"]}'
    const exact = base + ' '.repeat(4 * 1024 * 1024 - Buffer.byteLength(base))
    expect((await clinicDashboardNotificationsReadPostHandler(request(exact, {}, true))).status).toBe(200)
    mocks.mark.mockClear()
    const response = await clinicDashboardNotificationsReadPostHandler(request(exact + ' ', {}, true))
    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' }, writeOutcome: 'not_committed' })
    expect(mocks.mark).not.toHaveBeenCalled()
  })
})

describe('personal Website notification feed HTTP boundary', () => {
  const feedRequest = (query = 'mode=summary') =>
    Object.assign(
      new Request(`http://localhost:3000/api/clinic-dashboard/notifications?${query}`, {
        headers: {
          'X-Findmydoc-Clinic-Notifications-Contract': 'clinic-notifications-v1',
          'X-Findmydoc-Clinic-Scope-Contract': 'clinic-scope-v1',
        },
      }),
      { payload: { logger: { info: vi.fn() } } },
    ) as unknown as PayloadRequest

  it('reads the personal feed without a selected clinic and preserves private negotiation headers', async () => {
    const response = await clinicDashboardNotificationsGetHandler(feedRequest())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ mode: 'summary', unreadCount: 0 })
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Vary')).toContain('X-Findmydoc-Clinic-Scope-Contract')
  })

  it.each([
    ['unauthorized', 401, 'UNAUTHENTICATED'],
    ['access-denied', 403, 'CLINIC_ACCESS_DENIED'],
    ['unavailable', 503, 'SERVICE_UNAVAILABLE'],
  ] as const)('maps personal %s without reading clinic content', async (status, http, code) => {
    mocks.authorize.mockResolvedValueOnce({ status })
    const response = await clinicDashboardNotificationsGetHandler(feedRequest())
    expect(response.status).toBe(http)
    expect(await response.json()).toMatchObject({ error: { code } })
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it('rejects a client-selected clinic query and missing clinic-scope negotiation', async () => {
    expect((await clinicDashboardNotificationsGetHandler(feedRequest('mode=summary&clinicId=8'))).status).toBe(400)
    const req = feedRequest()
    req.headers.delete('X-Findmydoc-Clinic-Scope-Contract')
    const response = await clinicDashboardNotificationsGetHandler(req)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: { code: 'CONTRACT_INCOMPATIBLE' } })
    expect(mocks.read).not.toHaveBeenCalled()
  })
})
