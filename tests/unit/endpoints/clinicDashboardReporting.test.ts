import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clinicDashboardReportingGetHandler } from '@/endpoints/clinicDashboardReporting'
import { createMockPayload, createMockReq } from '../helpers/testHelpers'

const mocks = vi.hoisted(() => ({ resolveClinicDashboardReporting: vi.fn() }))

vi.mock('@/features/clinicDashboard/reporting/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/clinicDashboard/reporting/service')>()),
  resolveClinicDashboardReporting: mocks.resolveClinicDashboardReporting,
}))

const reportingPayload = {
  asOf: '2026-04-10T09:15:30.123Z',
  comparisonPeriod: { days: 7, from: '2026-03-27T21:00:00.000Z', to: '2026-04-03T09:15:30.123Z' },
  metrics: {},
  period: { days: 7, from: '2026-04-03T21:00:00.000Z', to: '2026-04-10T09:15:30.123Z' },
  schemaVersion: 'clinic-dashboard-reporting-v1',
  timezone: 'Europe/Istanbul',
}

const request = (query: string) => {
  const payload = createMockPayload()
  return createMockReq(null, payload, {
    headers: new Headers({ Authorization: 'Bearer clinic-token' }),
    searchParams: new URLSearchParams(query),
  })
}

const expectPrivateHeaders = (response: Response) => {
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('pragma')).toBe('no-cache')
  expect(response.headers.get('expires')).toBe('0')
  expect(response.headers.get('vary')).toBe('Authorization')
}

describe('Clinic Dashboard reporting endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveClinicDashboardReporting.mockResolvedValue({ status: 'success', data: reportingPayload })
  })

  it.each(['', 'periodDays=6', 'periodDays=07', 'periodDays=7&periodDays=30', 'periodDays=7&clinicId=other'])(
    'rejects invalid reporting input %s without resolving a clinic',
    async (query) => {
      const response = await clinicDashboardReportingGetHandler(request(query))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: {
          code: 'CLINIC_DASHBOARD_REPORTING_INVALID_INPUT',
          message: 'Reporting period must be 7, 30, or 90 days.',
        },
      })
      expect(mocks.resolveClinicDashboardReporting).not.toHaveBeenCalled()
      expectPrivateHeaders(response)
    },
  )

  it.each([7, 30, 90])('keeps the route request-bound for periodDays=%i', async (periodDays) => {
    const req = request(`periodDays=${periodDays}`)
    const response = await clinicDashboardReportingGetHandler(req)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(reportingPayload)
    expect(mocks.resolveClinicDashboardReporting).toHaveBeenCalledWith(req, periodDays)
    expectPrivateHeaders(response)
  })

  it.each([
    ['unauthorized', 401, 'CLINIC_DASHBOARD_UNAUTHORIZED', 'Authentication is required.'],
    ['access-denied', 403, 'CLINIC_DASHBOARD_ACCESS_DENIED', 'Reporting access is not available.'],
    ['unavailable', 503, 'CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE', 'Reporting is temporarily unavailable.'],
  ] as const)('returns the private %s error contract', async (status, httpStatus, code, message) => {
    mocks.resolveClinicDashboardReporting.mockResolvedValueOnce({ status })

    const response = await clinicDashboardReportingGetHandler(request('periodDays=7'))

    expect(response.status).toBe(httpStatus)
    await expect(response.json()).resolves.toEqual({ error: { code, message } })
    expectPrivateHeaders(response)
  })
})
