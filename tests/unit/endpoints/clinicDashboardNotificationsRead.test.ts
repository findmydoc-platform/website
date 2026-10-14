import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { ClinicNotificationError } from '@/features/clinicNotifications/errors'
import { clinicDashboardNotificationsReadPostHandler } from '@/endpoints/clinicDashboardNotifications'

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), mark: vi.fn() }))
vi.mock('@/features/clinicDashboard/authorization', () => ({ revalidateClinicDashboardRequest: mocks.authorize }))
vi.mock('@/features/clinicNotifications/service', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  markClinicNotificationsRead: mocks.mark,
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
  mocks.authorize.mockResolvedValue({ status: 'authorized' })
  mocks.mark.mockResolvedValue({
    contractVersion: 'clinic-notifications-v1',
    serverTime: '2026-10-14T09:00:01.000Z',
    acknowledged: true,
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
