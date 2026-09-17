import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ClinicDashboardReportingDTO,
  ReportingCountMetric,
  ReportingSourceState,
} from '@/features/clinicDashboard/reporting/contracts'
import { createMockPayload, createMockReq } from '../../../helpers/testHelpers'

const mocks = vi.hoisted(() => ({
  readPostHogClinicDashboardReporting: vi.fn(),
  revalidateClinicDashboardRequest: vi.fn(),
}))

vi.mock('@/features/clinicDashboard/authorization', () => ({
  revalidateClinicDashboardRequest: mocks.revalidateClinicDashboardRequest,
}))

vi.mock('@/features/clinicDashboard/reporting/posthog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/clinicDashboard/reporting/posthog')>()),
  readPostHogClinicDashboardReporting: mocks.readPostHogClinicDashboardReporting,
}))

import { createReportingWindows, resolveClinicDashboardReporting } from '@/features/clinicDashboard/reporting/service'

const now = new Date('2026-04-10T09:15:30.123Z')

const availablePostHog = {
  comparison: {
    ctaById: { choose_treatment: 2, contact: 3, contact_doctor: 4 },
    ctaTotal: 9,
    incompleteInquirySessionIds: 0,
    incompleteProfileViewSessionIds: 0,
    inquirySessions: 1,
    profileViews: 10,
    profileViewSessions: 2,
  },
  comparisonState: 'available' as const,
  current: {
    ctaById: { choose_treatment: 3, contact: 4, contact_doctor: 5 },
    ctaTotal: 12,
    incompleteInquirySessionIds: 0,
    incompleteProfileViewSessionIds: 0,
    inquirySessions: 2,
    profileViews: 20,
    profileViewSessions: 4,
  },
  currentState: 'available' as const,
}

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

const unknownMetric = <Source extends 'payload' | 'posthog'>(
  source: Source,
  state: ReportingSourceState,
): ReportingCountMetric & { source: Source } => ({
  comparison: { absoluteDelta: null, relativeDeltaPercent: null, state, value: null },
  current: { state, value: null },
  source,
})

const completeDto: ClinicDashboardReportingDTO = {
  asOf: '2026-04-10T09:15:30.123Z',
  comparisonPeriod: { days: 7, from: '2026-03-27T21:00:00.000Z', to: '2026-04-03T09:15:30.123Z' },
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
  period: { days: 7, from: '2026-04-03T21:00:00.000Z', to: '2026-04-10T09:15:30.123Z' },
  schemaVersion: 'clinic-dashboard-reporting-v1',
  timezone: 'Europe/Istanbul',
}

const withUnknownPostHog = (state: ReportingSourceState): ClinicDashboardReportingDTO => ({
  ...completeDto,
  metrics: {
    ...completeDto.metrics,
    ctaInteractions: {
      byCtaId: {
        choose_treatment: unknownMetric('posthog', state),
        contact: unknownMetric('posthog', state),
        contact_doctor: unknownMetric('posthog', state),
      },
      source: 'posthog',
      total: unknownMetric('posthog', state),
    },
    profileViews: unknownMetric('posthog', state),
    sessionConversion: {
      comparison: {
        denominatorSessions: null,
        numeratorSessions: null,
        percentagePointDelta: null,
        ratePercent: null,
        state,
      },
      current: { denominatorSessions: null, numeratorSessions: null, ratePercent: null, state },
      source: 'posthog',
    },
  },
})

const withPartialComparisonPostHog = (): ClinicDashboardReportingDTO => {
  const partialComparisonMetric = <Source extends 'posthog'>(metric: ReportingCountMetric & { source: Source }) => ({
    ...metric,
    comparison: {
      absoluteDelta: null,
      relativeDeltaPercent: null,
      state: 'partial_coverage' as const,
      value: null,
    },
  })

  return {
    ...completeDto,
    metrics: {
      ...completeDto.metrics,
      ctaInteractions: {
        byCtaId: {
          choose_treatment: partialComparisonMetric(completeDto.metrics.ctaInteractions.byCtaId.choose_treatment),
          contact: partialComparisonMetric(completeDto.metrics.ctaInteractions.byCtaId.contact),
          contact_doctor: partialComparisonMetric(completeDto.metrics.ctaInteractions.byCtaId.contact_doctor),
        },
        source: 'posthog',
        total: partialComparisonMetric(completeDto.metrics.ctaInteractions.total),
      },
      profileViews: partialComparisonMetric(completeDto.metrics.profileViews),
      sessionConversion: {
        comparison: {
          denominatorSessions: null,
          numeratorSessions: null,
          percentagePointDelta: null,
          ratePercent: null,
          state: 'partial_coverage',
        },
        current: completeDto.metrics.sessionConversion.current,
        source: 'posthog',
      },
    },
  }
}

const configuredPayload = (
  inquiryDocuments: Array<{ createdAt: string }> = [{ createdAt: '2026-04-08T10:00:00.000Z' }],
) => {
  const payload = createMockPayload()
  payload.find.mockImplementation(async ({ collection }: { collection: string }) => {
    if (collection === 'clinics') {
      return {
        docs: [
          {
            address: { city: 34, country: 77, houseNumber: '1', street: 'Main', zipCode: '34000' },
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
    if (collection === 'countries') return { docs: [{ isoCode: 'TR' }] }
    if (collection === 'patientClinicInquiries') {
      return { docs: inquiryDocuments, hasNextPage: false }
    }
    if (collection === 'reviews') return { docs: [{ starRating: 4 }, { starRating: 5 }], hasNextPage: false }
    if (collection === 'clinictreatments') return { docs: [{ id: 1 }] }
    throw new Error(`Unexpected collection ${collection}`)
  })
  return payload
}

const findFor = (payload: ReturnType<typeof createMockPayload>, collection: string) => {
  const call = payload.find.mock.calls.find(([args]) => (args as { collection?: string }).collection === collection)
  return call?.[0] as { where: unknown } | undefined
}

describe('Clinic Dashboard reporting service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.revalidateClinicDashboardRequest.mockResolvedValue({
      data: { clinic: { id: '8', name: 'Türkiye Clinic' } },
      status: 'authorized',
    })
    mocks.readPostHogClinicDashboardReporting.mockResolvedValue(availablePostHog)
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

  it('returns the complete immutable reporting-v1 DTO and scoped source reads', async () => {
    const payload = configuredPayload()

    const result = await resolveClinicDashboardReporting(createMockReq(null, payload), 7, now)

    expect(result).toEqual({ data: completeDto, status: 'success' })
    expect(mocks.readPostHogClinicDashboardReporting).toHaveBeenCalledWith({
      clinicId: '8',
      comparison: completeDto.comparisonPeriod,
      current: completeDto.period,
    })
    expect(findFor(payload, 'clinics')).toEqual(expect.objectContaining({ where: { id: { equals: '8' } } }))
    expect(findFor(payload, 'countries')).toEqual(
      expect.objectContaining({ where: { and: [{ id: { equals: 77 } }, { isoCode: { equals: 'TR' } }] } }),
    )
    expect(findFor(payload, 'patientClinicInquiries')).toEqual(
      expect.objectContaining({
        where: {
          and: expect.arrayContaining([
            { clinic: { equals: '8' } },
            { status: { in: ['submitted', 'in_review', 'contacted', 'closed'] } },
            { status: { not_equals: 'spam' } },
            { createdAt: { greater_than_equal: completeDto.comparisonPeriod.from } },
            { createdAt: { less_than_equal: completeDto.period.to } },
          ]),
        },
      }),
    )
    expect(findFor(payload, 'reviews')).toEqual(
      expect.objectContaining({
        where: {
          and: expect.arrayContaining([
            { clinic: { equals: '8' } },
            { status: { equals: 'approved' } },
            { withdrawalState: { equals: 'active' } },
            { deletedAt: { exists: false } },
          ]),
        },
      }),
    )
    expect(findFor(payload, 'clinictreatments')).toEqual(
      expect.objectContaining({ where: { and: [{ clinic: { equals: '8' } }, { active: { equals: true } }] } }),
    )
  })

  it('counts a depth-zero city relationship as a complete address area', async () => {
    const result = await resolveClinicDashboardReporting(createMockReq(null, configuredPayload()), 7, now)

    expect(result).toMatchObject({
      data: {
        metrics: {
          profileCompleteness: {
            completedAreas: 6,
            percent: 100,
            state: 'available',
            totalAreas: 6,
          },
        },
      },
      status: 'success',
    })
  })

  it('excludes an inquiry at comparison.to while including one at the current-period start', async () => {
    const result = await resolveClinicDashboardReporting(
      createMockReq(
        null,
        configuredPayload([{ createdAt: completeDto.comparisonPeriod.to }, { createdAt: completeDto.period.from }]),
      ),
      7,
      now,
    )

    expect(result).toMatchObject({
      data: {
        metrics: {
          inquiries: {
            comparison: { absoluteDelta: 1, relativeDeltaPercent: null, state: 'available', value: 0 },
            current: { state: 'available', value: 1 },
            source: 'payload',
          },
        },
      },
      status: 'success',
    })
  })

  it.each([
    ['profile view', 'incompleteProfileViewSessionIds'],
    ['inquiry', 'incompleteInquirySessionIds'],
  ] as const)('marks the funnel partial when %s correlation is missing, invalid, or censored', async (_, field) => {
    mocks.readPostHogClinicDashboardReporting.mockResolvedValue({
      ...availablePostHog,
      current: { ...availablePostHog.current, [field]: 1 },
    })

    const result = await resolveClinicDashboardReporting(createMockReq(null, configuredPayload()), 7, now)

    expect(result).toEqual({
      data: {
        ...completeDto,
        metrics: {
          ...completeDto.metrics,
          sessionConversion: {
            comparison: { ...completeDto.metrics.sessionConversion.comparison, percentagePointDelta: null },
            current: {
              denominatorSessions: null,
              numeratorSessions: null,
              ratePercent: null,
              state: 'partial_coverage',
            },
            source: 'posthog',
          },
        },
      },
      status: 'success',
    })
  })

  it('keeps available Payload zeros distinct from unknown PostHog values', async () => {
    mocks.readPostHogClinicDashboardReporting.mockResolvedValue({
      comparison: {
        ...availablePostHog.comparison,
        ctaTotal: 0,
        inquirySessions: 0,
        profileViews: 0,
        profileViewSessions: 0,
      },
      comparisonState: 'source_unavailable',
      current: {
        ...availablePostHog.current,
        ctaTotal: 0,
        inquirySessions: 0,
        profileViews: 0,
        profileViewSessions: 0,
      },
      currentState: 'source_unavailable',
    })
    const payload = configuredPayload()
    payload.find.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'patientClinicInquiries' || collection === 'reviews') return { docs: [], hasNextPage: false }
      if (collection === 'clinictreatments') return { docs: [] }
      if (collection === 'countries') return { docs: [{ isoCode: 'TR' }] }
      return {
        docs: [
          {
            address: { city: 'Istanbul', country: 77, houseNumber: '1', street: 'Main', zipCode: '34000' },
            description: { root: { children: [{ text: 'Description' }] } },
            name: 'Türkiye Clinic',
            openingHours: undefined,
            profileGallery: [],
            supportedLanguages: [],
            thumbnail: undefined,
          },
        ],
      }
    })

    const result = await resolveClinicDashboardReporting(createMockReq(null, payload), 7, now)

    expect(result).toMatchObject({
      data: {
        metrics: {
          inquiries: { comparison: { state: 'available', value: 0 }, current: { state: 'available', value: 0 } },
          profileViews: {
            comparison: { absoluteDelta: null, relativeDeltaPercent: null, state: 'source_unavailable', value: null },
            current: { state: 'source_unavailable', value: null },
          },
          reviews: {
            average: { state: 'no_reviews', value: null },
            count: { state: 'available', value: 0 },
          },
          sessionConversion: {
            comparison: {
              denominatorSessions: null,
              numeratorSessions: null,
              ratePercent: null,
              state: 'source_unavailable',
            },
            current: {
              denominatorSessions: null,
              numeratorSessions: null,
              ratePercent: null,
              state: 'source_unavailable',
            },
          },
        },
      },
      status: 'success',
    })
  })

  it.each(['source_unavailable', 'partial_coverage'] as const)(
    'keeps the full DTO when PostHog is %s without stale values or retries',
    async (state) => {
      mocks.readPostHogClinicDashboardReporting.mockResolvedValue({
        ...availablePostHog,
        comparisonState: state,
        currentState: state,
      })

      const result = await resolveClinicDashboardReporting(createMockReq(null, configuredPayload()), 7, now)

      expect(result).toEqual({ data: withUnknownPostHog(state), status: 'success' })
      expect(mocks.readPostHogClinicDashboardReporting).toHaveBeenCalledOnce()
    },
  )

  it('keeps current PostHog values while suppressing a partial comparison and every dependent delta', async () => {
    mocks.readPostHogClinicDashboardReporting.mockResolvedValue({
      ...availablePostHog,
      comparisonState: 'partial_coverage',
    })

    const result = await resolveClinicDashboardReporting(createMockReq(null, configuredPayload()), 7, now)

    expect(result).toEqual({ data: withPartialComparisonPostHog(), status: 'success' })
  })

  it('emits zero_denominator only for a complete session funnel with no profiles', async () => {
    mocks.readPostHogClinicDashboardReporting.mockResolvedValue({
      ...availablePostHog,
      comparison: { ...availablePostHog.comparison, inquirySessions: 0, profileViewSessions: 0 },
      current: { ...availablePostHog.current, inquirySessions: 0, profileViewSessions: 0 },
    })

    const result = await resolveClinicDashboardReporting(createMockReq(null, configuredPayload()), 7, now)

    expect(result).toMatchObject({
      data: {
        metrics: {
          sessionConversion: {
            comparison: {
              denominatorSessions: 0,
              numeratorSessions: 0,
              percentagePointDelta: null,
              ratePercent: null,
              state: 'zero_denominator',
            },
            current: { denominatorSessions: 0, numeratorSessions: 0, ratePercent: null, state: 'zero_denominator' },
          },
        },
      },
      status: 'success',
    })
  })

  it.each([
    ['unauthorized', { status: 'unauthorized' }],
    ['access denied', { status: 'access-denied' }],
  ] as const)('stops before every source read for %s', async (_, access) => {
    mocks.revalidateClinicDashboardRequest.mockResolvedValueOnce(access)
    const payload = configuredPayload()

    await expect(resolveClinicDashboardReporting(createMockReq(null, payload), 7, now)).resolves.toEqual(access)
    expect(payload.find).not.toHaveBeenCalled()
    expect(mocks.readPostHogClinicDashboardReporting).not.toHaveBeenCalled()
  })

  it('keeps an individual Payload failure metric-local while PostHog remains available', async () => {
    const payload = configuredPayload()
    payload.find.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'patientClinicInquiries') throw new Error('source unavailable')
      if (collection === 'reviews') return { docs: [{ starRating: 4 }, { starRating: 5 }], hasNextPage: false }
      if (collection === 'clinictreatments') return { docs: [{ id: 1 }] }
      if (collection === 'countries') return { docs: [{ isoCode: 'TR' }] }
      return {
        docs: [
          {
            address: { city: 'Istanbul', country: 77, houseNumber: '1', street: 'Main', zipCode: '34000' },
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
    })

    const result = await resolveClinicDashboardReporting(createMockReq(null, payload), 7, now)

    expect(result).toMatchObject({
      data: {
        metrics: {
          inquiries: {
            comparison: { absoluteDelta: null, relativeDeltaPercent: null, state: 'source_unavailable', value: null },
            current: { state: 'source_unavailable', value: null },
          },
          profileViews: completeDto.metrics.profileViews,
        },
      },
      status: 'success',
    })
  })
})
