import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockPayload, createMockReq } from '../../../helpers/testHelpers'

const mocks = vi.hoisted(() => ({ revalidateClinicDashboardTargetRequest: vi.fn() }))
vi.mock('@/features/clinicDashboard/authorization', () => ({
  revalidateClinicDashboardTargetRequest: mocks.revalidateClinicDashboardTargetRequest,
}))
import { createReportingWindows, resolveClinicDashboardReportingV2 } from '@/features/clinicDashboard/reporting/service'

const now = new Date('2026-04-10T09:15:30.123Z')
const configuredPayload = (inquiries = [{ createdAt: '2026-04-08T10:00:00.000Z' }], inquiryUnavailable = false) => {
  const payload = createMockPayload()
  payload.find.mockImplementation(async ({ collection }: { collection: string }) => {
    if (collection === 'clinics') return { docs: [{ id: 8, address: { country: 77 } }] }
    if (collection === 'countries') return { docs: [{ isoCode: 'TR' }] }
    if (collection === 'patientClinicInquiries') {
      if (inquiryUnavailable) throw new Error('synthetic outage')
      return { docs: inquiries, hasNextPage: false }
    }
    if (collection === 'reviews') return { docs: [{ starRating: 4 }, { starRating: 5 }], hasNextPage: false }
    throw new Error(`Unexpected collection ${collection}`)
  })
  return payload
}
const analyticsResponse = () =>
  Response.json({
    columns: [
      'current_profileViews',
      'current_uniqueVisitors',
      'current_impressions',
      'current_inquiryStarters',
      'current_missingVisitors',
      'current_missingStarters',
      'comparison_profileViews',
      'comparison_uniqueVisitors',
      'comparison_impressions',
      'comparison_inquiryStarters',
      'comparison_missingVisitors',
      'comparison_missingStarters',
    ],
    results: [[20, 12, 40, 2, 0, 0, 10, 6, 20, 1, 0, 0]],
  })
const read = (payload = configuredPayload()) =>
  resolveClinicDashboardReportingV2(createMockReq(null, payload), '8', 7, now)
const findFor = (payload: ReturnType<typeof createMockPayload>, collection: string) =>
  payload.find.mock.calls.find(([args]) => (args as { collection?: string }).collection === collection)?.[0]

describe('Clinic Dashboard five-count reporting service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.revalidateClinicDashboardTargetRequest.mockResolvedValue({ clinicId: '8', status: 'authorized' })
    vi.stubEnv('POSTHOG_QUERY_API_KEY', 'synthetic-key')
    vi.stubEnv('POSTHOG_QUERY_PROJECT_ID', 'synthetic-project')
    vi.stubEnv('POSTHOG_QUERY_RETENTION_DAYS', '365')
    for (const setting of [
      'POSTHOG_PROFILE_VIEWS_CAPTURE_STARTED_AT',
      'POSTHOG_IMPRESSIONS_CAPTURE_STARTED_AT',
      'POSTHOG_INQUIRY_STARTERS_CAPTURE_STARTED_AT',
    ])
      vi.stubEnv(setting, '2025-01-01T00:00:00.000Z')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => analyticsResponse()),
    )
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('returns the closed V2 counts and independently scoped Payload facts', async () => {
    const payload = configuredPayload()
    const result = await read(payload)
    expect(result.status).toBe('success')
    if (result.status !== 'success') throw new Error('Expected authorized reporting')
    expect(result.data.schemaVersion).toBe('clinic-dashboard-reporting-v2')
    expect(Object.keys(result.data.metrics).sort()).toEqual([
      'impressions',
      'inquiries',
      'inquiryStarters',
      'profileViews',
      'reviews',
      'uniqueVisitors',
    ])
    expect(result.data.metrics.profileViews).toEqual({
      source: 'posthog',
      current: { value: 20, state: 'available' },
      comparison: { value: 10, state: 'available', absoluteDelta: 10, relativeDeltaPercent: 100 },
    })
    expect(result.data.metrics.inquiries.current).toEqual({ value: 1, state: 'available' })
    expect(result.data.metrics.reviews.average.value).toBe(4.5)
    expect(findFor(payload, 'patientClinicInquiries')).toMatchObject({
      where: {
        and: expect.arrayContaining([
          { clinic: { equals: '8' } },
          { status: { in: ['submitted', 'in_review', 'contacted', 'closed'] } },
          { status: { not_equals: 'spam' } },
          { createdAt: { greater_than_equal: '2026-03-27T21:00:00.000Z' } },
          { createdAt: { less_than_equal: '2026-04-10T09:15:30.123Z' } },
        ]),
      },
    })
    expect(findFor(payload, 'reviews')).toMatchObject({
      where: {
        and: expect.arrayContaining([
          { clinic: { equals: '8' } },
          { status: { equals: 'approved' } },
          { withdrawalState: { equals: 'active' } },
          { deletedAt: { exists: false } },
        ]),
      },
    })
    expect(fetch).toHaveBeenCalledOnce()
  })

  it.each([
    [7, '2026-03-27T21:00:00.000Z', '2026-04-03T09:15:30.123Z', '2026-04-03T21:00:00.000Z'],
    [30, '2026-02-09T21:00:00.000Z', '2026-03-11T09:15:30.123Z', '2026-03-11T21:00:00.000Z'],
    [90, '2025-10-12T21:00:00.000Z', '2026-01-10T09:15:30.123Z', '2026-01-10T21:00:00.000Z'],
  ] as const)('uses Istanbul calendar boundaries for %i days', (days, comparisonFrom, comparisonTo, currentFrom) => {
    expect(createReportingWindows(days, now)).toEqual({
      asOf: '2026-04-10T09:15:30.123Z',
      comparison: { days, from: comparisonFrom, to: comparisonTo },
      current: { days, from: currentFrom, to: '2026-04-10T09:15:30.123Z' },
    })
  })

  it('rejects a mismatched source clinic before reading its metrics', async () => {
    const payload = configuredPayload()
    payload.find.mockResolvedValue({ docs: [{ id: 99, address: { country: { isoCode: 'TR' } } }] })
    expect(await read(payload)).toEqual({ status: 'access-denied' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('excludes comparison.to and includes the current period start', async () => {
    const result = await read(
      configuredPayload([{ createdAt: '2026-04-03T09:15:30.123Z' }, { createdAt: '2026-04-03T21:00:00.000Z' }]),
    )
    expect(result).toMatchObject({
      status: 'success',
      data: {
        metrics: {
          inquiries: {
            comparison: { value: 0, state: 'available', absoluteDelta: 1, relativeDeltaPercent: null },
            current: { value: 1, state: 'available' },
          },
        },
      },
    })
  })

  it('keeps Payload zero and reviews independent of an analytics outage without a stale fallback', async () => {
    await read()
    vi.mocked(fetch).mockRejectedValueOnce(new Error('synthetic outage'))
    const result = await read(configuredPayload([]))
    expect(result).toMatchObject({
      status: 'success',
      data: {
        metrics: {
          inquiries: { current: { value: 0, state: 'available' } },
          profileViews: { current: { value: null, state: 'source_unavailable' } },
          uniqueVisitors: { current: { value: null, state: 'source_unavailable' } },
          reviews: { average: { value: 4.5, state: 'available' } },
        },
      },
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps an inquiry failure local while analytics remains available', async () => {
    const payload = configuredPayload([], true)
    expect(await read(payload)).toMatchObject({
      status: 'success',
      data: {
        metrics: {
          inquiries: { current: { value: null, state: 'source_unavailable' } },
          profileViews: { current: { value: 20, state: 'available' } },
        },
      },
    })
  })

  it.each(['unauthorized', 'access-denied'] as const)('stops all source access for %s', async (status) => {
    mocks.revalidateClinicDashboardTargetRequest.mockResolvedValueOnce({ status })
    const payload = configuredPayload()
    expect(await read(payload)).toEqual({ status })
    expect(payload.find).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
