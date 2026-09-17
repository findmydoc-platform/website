import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockPayload, createMockReq } from '../../../helpers/testHelpers'

const mocks = vi.hoisted(() => ({
  readPostHogClinicDashboardReporting: vi.fn(),
  resolveClinicDashboardBootstrap: vi.fn(),
}))

vi.mock('@/features/clinicDashboard/bootstrap', () => ({
  resolveClinicDashboardBootstrap: mocks.resolveClinicDashboardBootstrap,
}))

vi.mock('@/features/clinicDashboard/reporting/posthog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/clinicDashboard/reporting/posthog')>()),
  readPostHogClinicDashboardReporting: mocks.readPostHogClinicDashboardReporting,
}))

import { createReportingWindows, resolveClinicDashboardReporting } from '@/features/clinicDashboard/reporting/service'

const availablePostHog = {
  comparison: {
    ctaById: { choose_treatment: 2, contact: 3, contact_doctor: 4 },
    ctaTotal: 9,
    inquirySessions: 1,
    missingCorrelationEvents: 0,
    profileViews: 10,
    profileViewSessions: 2,
  },
  comparisonState: 'available' as const,
  current: {
    ctaById: { choose_treatment: 3, contact: 4, contact_doctor: 5 },
    ctaTotal: 12,
    inquirySessions: 2,
    missingCorrelationEvents: 0,
    profileViews: 20,
    profileViewSessions: 4,
  },
  currentState: 'available' as const,
}

describe('Clinic Dashboard reporting service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveClinicDashboardBootstrap.mockResolvedValue({
      data: { clinic: { id: '8', name: 'Türkiye Clinic' } },
      status: 'success',
    })
    mocks.readPostHogClinicDashboardReporting.mockResolvedValue(availablePostHog)
  })

  it('uses Istanbul day boundaries with an equivalent comparison clock boundary', () => {
    expect(createReportingWindows(7, new Date('2026-04-10T09:15:30.123Z'))).toEqual({
      asOf: '2026-04-10T09:15:30.123Z',
      comparison: { days: 7, from: '2026-03-27T21:00:00.000Z', to: '2026-04-03T09:15:30.123Z' },
      current: { days: 7, from: '2026-04-03T21:00:00.000Z', to: '2026-04-10T09:15:30.123Z' },
    })
  })

  it('returns the fixed metric catalogue, scoped Payload data, and no cache primitives', async () => {
    const payload = createMockPayload()
    payload.find.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'clinics') {
        return {
          docs: [
            {
              address: {
                city: 'Istanbul',
                country: { isoCode: 'TR' },
                houseNumber: '1',
                street: 'Main',
                zipCode: '34000',
              },
              description: { root: { children: [{ text: 'Description' }] } },
              name: 'Türkiye Clinic',
              openingHours: {
                friday: { closesAt: '17:00', isClosed: false, opensAt: '09:00' },
                monday: { closesAt: '17:00', isClosed: false, opensAt: '09:00' },
                saturday: { closesAt: null, isClosed: true, opensAt: null },
                sunday: { closesAt: null, isClosed: true, opensAt: null },
                thursday: { closesAt: '17:00', isClosed: false, opensAt: '09:00' },
                tuesday: { closesAt: '17:00', isClosed: false, opensAt: '09:00' },
                wednesday: { closesAt: '17:00', isClosed: false, opensAt: '09:00' },
              },
              profileGallery: [1, 2, 3],
              supportedLanguages: ['turkish'],
              thumbnail: 1,
            },
          ],
        }
      }
      if (collection === 'patientClinicInquiries') {
        return { docs: [{ createdAt: '2026-04-08T10:00:00.000Z' }], hasNextPage: false }
      }
      if (collection === 'reviews') {
        return { docs: [{ starRating: 4 }, { starRating: 5 }], hasNextPage: false }
      }
      if (collection === 'clinictreatments') return { docs: [{ id: 1 }] }
      return { docs: [] }
    })
    const req = createMockReq(null, payload)

    const result = await resolveClinicDashboardReporting(req, 7, new Date('2026-04-10T09:15:30.123Z'))

    expect(result).toMatchObject({
      data: {
        schemaVersion: 'clinic-dashboard-reporting-v1',
        timezone: 'Europe/Istanbul',
        metrics: {
          profileViews: { current: { state: 'available', value: 20 }, source: 'posthog' },
          ctaInteractions: { source: 'posthog', total: { current: { value: 12 } } },
          inquiries: { current: { value: 1 }, source: 'payload' },
          sessionConversion: { current: { denominatorSessions: 4, numeratorSessions: 2, ratePercent: 50 } },
          reviews: { average: { state: 'available', value: 4.5 }, count: { value: 2 } },
          profileCompleteness: { completedAreas: 6, percent: 100, totalAreas: 6 },
        },
      },
      status: 'success',
    })
    expect(mocks.readPostHogClinicDashboardReporting).toHaveBeenCalledOnce()
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'patientClinicInquiries' }))
    expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'reviews' }))
  })

  it('keeps unknown metric values null and does not manufacture a funnel zero', async () => {
    mocks.readPostHogClinicDashboardReporting.mockResolvedValue({
      ...availablePostHog,
      current: { ...availablePostHog.current, missingCorrelationEvents: 1 },
    })
    const payload = createMockPayload()
    payload.find.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'clinics') return { docs: [{ address: { country: { isoCode: 'TR' } } }] }
      throw new Error(`${collection} unavailable`)
    })

    const result = await resolveClinicDashboardReporting(createMockReq(null, payload), 7)

    expect(result).toMatchObject({
      data: {
        metrics: {
          inquiries: { current: { state: 'source_unavailable', value: null } },
          sessionConversion: {
            current: {
              denominatorSessions: null,
              numeratorSessions: null,
              ratePercent: null,
              state: 'partial_coverage',
            },
          },
        },
      },
      status: 'success',
    })
  })
})
