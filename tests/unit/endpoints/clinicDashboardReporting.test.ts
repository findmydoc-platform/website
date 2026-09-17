import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clinicDashboardReportingGetHandler } from '@/endpoints/clinicDashboardReporting'
import type { ClinicDashboardReportingDTO, ReportingCountMetric } from '@/features/clinicDashboard/reporting/contracts'
import { createMockPayload, createMockReq } from '../helpers/testHelpers'

const mocks = vi.hoisted(() => ({ resolveClinicDashboardReporting: vi.fn() }))

vi.mock('@/features/clinicDashboard/reporting/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/clinicDashboard/reporting/service')>()),
  resolveClinicDashboardReporting: mocks.resolveClinicDashboardReporting,
}))

const metric = <Source extends 'payload' | 'posthog'>(
  source: Source,
  current: number,
  comparison: number,
): ReportingCountMetric & { source: Source } => ({
  comparison: {
    absoluteDelta: current - comparison,
    relativeDeltaPercent: comparison === 0 ? null : ((current - comparison) / comparison) * 100,
    state: 'available' as const,
    value: comparison,
  },
  current: { state: 'available' as const, value: current },
  source,
})

const reportingPayload = (days: 7 | 30 | 90): ClinicDashboardReportingDTO => ({
  asOf: '2026-04-10T09:15:30.123Z',
  comparisonPeriod: { days, from: '2026-03-27T21:00:00.000Z', to: '2026-04-03T09:15:30.123Z' },
  metrics: {
    ctaInteractions: {
      byCtaId: {
        choose_treatment: metric('posthog', 3, 2),
        contact: metric('posthog', 4, 3),
        contact_doctor: metric('posthog', 5, 4),
      },
      source: 'posthog',
      total: metric('posthog', 12, 9),
    },
    inquiries: metric('payload', 1, 0),
    profileCompleteness: {
      comparison: null,
      completedAreas: 6,
      percent: 100,
      source: 'payload',
      state: 'available',
      totalAreas: 6,
    },
    profileViews: metric('posthog', 20, 10),
    reviews: {
      average: { comparison: null, source: 'payload', state: 'available', value: 4.5 },
      count: { comparison: null, source: 'payload', state: 'available', value: 2 },
      source: 'payload',
    },
    sessionConversion: {
      comparison: {
        denominatorSessions: 2,
        numeratorSessions: 1,
        percentagePointDelta: 0,
        ratePercent: 50,
        state: 'available',
      },
      current: { denominatorSessions: 4, numeratorSessions: 2, ratePercent: 50, state: 'available' },
      source: 'posthog',
    },
  },
  period: { days, from: '2026-04-03T21:00:00.000Z', to: '2026-04-10T09:15:30.123Z' },
  schemaVersion: 'clinic-dashboard-reporting-v1',
  timezone: 'Europe/Istanbul',
})

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
    mocks.resolveClinicDashboardReporting.mockImplementation(async (_, periodDays) => ({
      data: reportingPayload(periodDays as 7 | 30 | 90),
      status: 'success',
    }))
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
    await expect(response.json()).resolves.toEqual(reportingPayload(periodDays as 7 | 30 | 90))
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

  it('contains an unexpected reporting-service rejection in the normative private 503 envelope', async () => {
    mocks.resolveClinicDashboardReporting.mockRejectedValueOnce(new Error('private upstream failure'))

    const response = await clinicDashboardReportingGetHandler(request('periodDays=7'))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'CLINIC_DASHBOARD_TEMPORARILY_UNAVAILABLE',
        message: 'Reporting is temporarily unavailable.',
      },
    })
    expectPrivateHeaders(response)
  })
})
