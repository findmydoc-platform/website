import { validateOpeningHours } from '@/collections/clinics/openingHours'
import { revalidateClinicDashboardRequest } from '@/features/clinicDashboard/authorization'
import type { PayloadRequest, Where } from 'payload'
import {
  CLINIC_DASHBOARD_REPORTING_SCHEMA_VERSION,
  REPORTING_PERIOD_DAYS,
  type ClinicDashboardReportingDTO,
  type ReportingCountMetric,
  type ReportingMetricValue,
  type ReportingPeriodDays,
  type ReportingSessionConversionMetric,
  type ReportingSourceState,
} from './contracts'
import { readPostHogClinicDashboardReporting, type PostHogReportingRead, type PostHogReportingValues } from './posthog'

const ISTANBUL_TIME_ZONE = 'Europe/Istanbul' as const
const INQUIRY_STATUSES = ['submitted', 'in_review', 'contacted', 'closed'] as const

type ReportingWindow = {
  days: ReportingPeriodDays
  from: string
  to: string
}

type ReportingWindows = {
  asOf: string
  comparison: ReportingWindow
  current: ReportingWindow
}

type RecordValue = Record<string, unknown>

export type ClinicDashboardReportingResult =
  | { status: 'success'; data: ClinicDashboardReportingDTO }
  | { status: 'unauthorized' }
  | { status: 'access-denied' }
  | { status: 'unavailable' }

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const relationId = (value: unknown): number | string | undefined => {
  if (typeof value === 'number' || typeof value === 'string') return value
  return isRecord(value) && (typeof value.id === 'number' || typeof value.id === 'string') ? value.id : undefined
}

const nonBlankString = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0

const formatParts = (value: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: ISTANBUL_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(value)
  const numeric = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value)
  return {
    day: numeric('day'),
    hour: numeric('hour'),
    minute: numeric('minute'),
    month: numeric('month'),
    second: numeric('second'),
    year: numeric('year'),
  }
}

const utcFromIstanbul = ({
  day,
  hour,
  millisecond,
  minute,
  month,
  second,
  year,
}: {
  day: number
  hour: number
  millisecond: number
  minute: number
  month: number
  second: number
  year: number
}): Date => {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond))
  const local = formatParts(guess)
  const localAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
    millisecond,
  )
  return new Date(guess.getTime() - (localAsUtc - guess.getTime()))
}

const moveIstanbulDate = (parts: ReturnType<typeof formatParts>, days: number) => {
  const moved = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return { day: moved.getUTCDate(), month: moved.getUTCMonth() + 1, year: moved.getUTCFullYear() }
}

export const createReportingWindows = (periodDays: ReportingPeriodDays, now = new Date()): ReportingWindows => {
  const asOf = new Date(now.getTime())
  const local = formatParts(asOf)
  const currentStartDate = moveIstanbulDate(local, 1 - periodDays)
  const comparisonStartDate = moveIstanbulDate(local, 1 - periodDays * 2)
  const comparisonEndDate = moveIstanbulDate(local, -periodDays)
  const currentFrom = utcFromIstanbul({ ...currentStartDate, hour: 0, millisecond: 0, minute: 0, second: 0 })
  const comparisonFrom = utcFromIstanbul({ ...comparisonStartDate, hour: 0, millisecond: 0, minute: 0, second: 0 })
  const comparisonTo = utcFromIstanbul({
    ...comparisonEndDate,
    hour: local.hour,
    millisecond: asOf.getUTCMilliseconds(),
    minute: local.minute,
    second: local.second,
  })
  const to = asOf.toISOString()

  return {
    asOf: to,
    comparison: { days: periodDays, from: comparisonFrom.toISOString(), to: comparisonTo.toISOString() },
    current: { days: periodDays, from: currentFrom.toISOString(), to },
  }
}

const unavailableValue = (state: ReportingSourceState): ReportingMetricValue => ({ state, value: null })

const countMetric = (
  source: ReportingCountMetric['source'],
  current: number | undefined,
  currentState: ReportingSourceState,
  comparison: number | undefined,
  comparisonState: ReportingSourceState,
): ReportingCountMetric => {
  const currentValue = currentState === 'available' && typeof current === 'number' ? current : null
  const comparisonValue = comparisonState === 'available' && typeof comparison === 'number' ? comparison : null
  const absoluteDelta = currentValue !== null && comparisonValue !== null ? currentValue - comparisonValue : null
  const relativeDeltaPercent =
    absoluteDelta !== null && comparisonValue !== null && comparisonValue !== 0
      ? (absoluteDelta / comparisonValue) * 100
      : null
  return {
    comparison: {
      ...unavailableValue(comparisonState),
      value: comparisonValue,
      absoluteDelta,
      relativeDeltaPercent,
    },
    current: { ...unavailableValue(currentState), value: currentValue },
    source,
  }
}

const sessionMetric = (read: PostHogReportingRead): ReportingSessionConversionMetric => {
  const toWindow = (values: PostHogReportingValues, state: ReportingSourceState) => {
    if (state !== 'available' || values.incompleteProfileViewSessionIds > 0 || values.incompleteInquirySessionIds > 0) {
      return {
        denominatorSessions: null,
        numeratorSessions: null,
        ratePercent: null,
        state: state === 'available' ? 'partial_coverage' : state,
      } as const
    }
    if (values.profileViewSessions === 0) {
      return { denominatorSessions: 0, numeratorSessions: 0, ratePercent: null, state: 'zero_denominator' } as const
    }
    return {
      denominatorSessions: values.profileViewSessions,
      numeratorSessions: values.inquirySessions,
      ratePercent: (values.inquirySessions / values.profileViewSessions) * 100,
      state: 'available',
    } as const
  }
  const current = toWindow(read.current, read.currentState)
  const comparison = toWindow(read.comparison, read.comparisonState)
  return {
    comparison: {
      ...comparison,
      percentagePointDelta:
        current.ratePercent !== null && comparison.ratePercent !== null
          ? current.ratePercent - comparison.ratePercent
          : null,
    },
    current,
    source: 'posthog',
  }
}

const countAllDocuments = async (
  req: PayloadRequest,
  collection: 'patientClinicInquiries' | 'reviews',
  where: Where,
) => {
  let page = 1
  let documents: RecordValue[] = []
  for (;;) {
    const result = await req.payload.find({
      collection,
      depth: 0,
      limit: 100,
      overrideAccess: true,
      page,
      pagination: true,
      req,
      select: collection === 'patientClinicInquiries' ? { createdAt: true } : { starRating: true },
      where,
    })
    documents = [...documents, ...(result.docs as unknown as RecordValue[])]
    if (!result.hasNextPage) return documents
    page += 1
  }
}

const inCurrentOrComparison = (date: unknown, window: ReportingWindow): boolean => {
  const parsed = typeof date === 'string' ? Date.parse(date) : Number.NaN
  return Number.isFinite(parsed) && parsed >= Date.parse(window.from) && parsed <= Date.parse(window.to)
}

const resolveInquiryMetrics = async (req: PayloadRequest, clinicId: string, windows: ReportingWindows) => {
  const inquiries = await countAllDocuments(req, 'patientClinicInquiries', {
    and: [
      { clinic: { equals: clinicId } },
      { status: { in: [...INQUIRY_STATUSES] } },
      { status: { not_equals: 'spam' } },
      { createdAt: { greater_than_equal: windows.comparison.from } },
      { createdAt: { less_than_equal: windows.current.to } },
    ],
  })
  return {
    comparison: inquiries.filter((inquiry) => inCurrentOrComparison(inquiry.createdAt, windows.comparison)).length,
    current: inquiries.filter((inquiry) => inCurrentOrComparison(inquiry.createdAt, windows.current)).length,
  }
}

const resolveReviews = async (req: PayloadRequest, clinicId: string) => {
  const reviews = await countAllDocuments(req, 'reviews', {
    and: [
      { clinic: { equals: clinicId } },
      { status: { equals: 'approved' } },
      { withdrawalState: { equals: 'active' } },
      { deletedAt: { exists: false } },
    ],
  })
  const ratings = reviews
    .map((review) => review.starRating)
    .filter((rating): rating is number => typeof rating === 'number' && Number.isFinite(rating))
  if (ratings.length !== reviews.length) throw new Error('Approved review rating is invalid')
  return {
    average: ratings.length === 0 ? null : ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
    count: ratings.length,
  }
}

const hasValidAddress = (value: unknown): boolean => {
  if (!isRecord(value)) return false
  return (
    ['street', 'houseNumber', 'zipCode', 'city'].every((field) => nonBlankString(value[field])) &&
    (relationId(value.country) !== undefined || (isRecord(value.country) && nonBlankString(value.country.isoCode)))
  )
}

const hasRichTextContent = (value: unknown): boolean => {
  if (!isRecord(value) || !isRecord(value.root)) return false
  return Array.isArray(value.root.children) && value.root.children.length > 0
}

const resolveProfileCompleteness = async (req: PayloadRequest, clinic: RecordValue, clinicId: string) => {
  const clinicTreatments = await req.payload.find({
    collection: 'clinictreatments',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    select: { active: true },
    where: { and: [{ clinic: { equals: clinicId } }, { active: { equals: true } }] },
  })
  const profileGallery = Array.isArray(clinic.profileGallery) ? clinic.profileGallery : []
  const uniqueGalleryIds = new Set(
    profileGallery.map(relationId).filter((id): id is number | string => id !== undefined),
  )
  const completedAreas = [
    nonBlankString(clinic.name) && hasRichTextContent(clinic.description),
    hasValidAddress(clinic.address),
    Array.isArray(clinic.supportedLanguages) && clinic.supportedLanguages.length > 0,
    validateOpeningHours(clinic.openingHours) === true && clinic.openingHours !== undefined,
    uniqueGalleryIds.size >= 3 && relationId(clinic.thumbnail) === profileGallery.map(relationId)[0],
    clinicTreatments.docs.length > 0,
  ].filter(Boolean).length
  return { completedAreas, percent: (completedAreas / 6) * 100 }
}

const resolveClinic = async (req: PayloadRequest, clinicId: string): Promise<RecordValue | null> => {
  const result = await req.payload.find({
    collection: 'clinics',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    select: {
      address: true,
      description: true,
      name: true,
      openingHours: true,
      profileGallery: true,
      supportedLanguages: true,
      thumbnail: true,
    },
    where: { id: { equals: clinicId } },
  })
  const clinic = result.docs[0]
  return isRecord(clinic) ? clinic : null
}

const isTürkiyeClinic = async (req: PayloadRequest, clinic: RecordValue): Promise<boolean> => {
  const address = isRecord(clinic.address) ? clinic.address : undefined
  const country = address?.country
  if (isRecord(country) && country.isoCode === 'TR') return true
  const id = relationId(country)
  if (id === undefined) return false
  const result = await req.payload.find({
    collection: 'countries',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    select: { isoCode: true },
    where: { and: [{ id: { equals: id } }, { isoCode: { equals: 'TR' } }] },
  })
  return result.docs.length === 1
}

export async function resolveClinicDashboardReporting(
  req: PayloadRequest,
  periodDays: ReportingPeriodDays,
  now = new Date(),
): Promise<ClinicDashboardReportingResult> {
  const access = await revalidateClinicDashboardRequest(req, 'legacy')
  if (access.status !== 'authorized') return access
  const clinicId = access.data.clinic.id
  const windows = createReportingWindows(periodDays, now)

  let clinic: RecordValue | null
  try {
    clinic = await resolveClinic(req, clinicId)
    if (!clinic || !(await isTürkiyeClinic(req, clinic))) return { status: 'access-denied' }
  } catch {
    return { status: 'unavailable' }
  }

  const [inquiries, reviews, completeness, posthog] = await Promise.allSettled([
    resolveInquiryMetrics(req, clinicId, windows),
    resolveReviews(req, clinicId),
    resolveProfileCompleteness(req, clinic, clinicId),
    readPostHogClinicDashboardReporting({ clinicId, comparison: windows.comparison, current: windows.current }),
  ])
  const payloadState: ReportingSourceState = 'source_unavailable'
  const posthogResult: PostHogReportingRead =
    posthog.status === 'fulfilled'
      ? posthog.value
      : {
          comparison: {
            ctaById: { choose_treatment: 0, contact: 0, contact_doctor: 0 },
            ctaTotal: 0,
            inquirySessions: 0,
            incompleteInquirySessionIds: 0,
            incompleteProfileViewSessionIds: 0,
            profileViews: 0,
            profileViewSessions: 0,
          },
          comparisonState: 'source_unavailable',
          current: {
            ctaById: { choose_treatment: 0, contact: 0, contact_doctor: 0 },
            ctaTotal: 0,
            inquirySessions: 0,
            incompleteInquirySessionIds: 0,
            incompleteProfileViewSessionIds: 0,
            profileViews: 0,
            profileViewSessions: 0,
          },
          currentState: 'source_unavailable',
        }

  const inquiryMetric =
    inquiries.status === 'fulfilled'
      ? countMetric('payload', inquiries.value.current, 'available', inquiries.value.comparison, 'available')
      : countMetric('payload', undefined, payloadState, undefined, payloadState)
  const reviewValues = reviews.status === 'fulfilled' ? reviews.value : undefined
  const completenessValues = completeness.status === 'fulfilled' ? completeness.value : undefined
  const posthogMetric = (value: (values: PostHogReportingValues) => number): ReportingCountMetric =>
    countMetric(
      'posthog',
      value(posthogResult.current),
      posthogResult.currentState,
      value(posthogResult.comparison),
      posthogResult.comparisonState,
    )

  return {
    status: 'success',
    data: {
      asOf: windows.asOf,
      comparisonPeriod: windows.comparison,
      metrics: {
        ctaInteractions: {
          byCtaId: {
            choose_treatment: posthogMetric(
              (values) => values.ctaById.choose_treatment,
            ) as ClinicDashboardReportingDTO['metrics']['ctaInteractions']['byCtaId']['choose_treatment'],
            contact: posthogMetric(
              (values) => values.ctaById.contact,
            ) as ClinicDashboardReportingDTO['metrics']['ctaInteractions']['byCtaId']['contact'],
            contact_doctor: posthogMetric(
              (values) => values.ctaById.contact_doctor,
            ) as ClinicDashboardReportingDTO['metrics']['ctaInteractions']['byCtaId']['contact_doctor'],
          },
          source: 'posthog',
          total: posthogMetric(
            (values) => values.ctaTotal,
          ) as ClinicDashboardReportingDTO['metrics']['ctaInteractions']['total'],
        },
        inquiries: inquiryMetric as ClinicDashboardReportingDTO['metrics']['inquiries'],
        profileCompleteness: completenessValues
          ? {
              comparison: null,
              completedAreas: completenessValues.completedAreas,
              percent: completenessValues.percent,
              source: 'payload',
              state: 'available',
              totalAreas: 6,
            }
          : {
              comparison: null,
              completedAreas: null,
              percent: null,
              source: 'payload',
              state: payloadState,
              totalAreas: 6,
            },
        profileViews: posthogMetric(
          (values) => values.profileViews,
        ) as ClinicDashboardReportingDTO['metrics']['profileViews'],
        reviews: {
          average: reviewValues
            ? reviewValues.count === 0
              ? { comparison: null, source: 'payload', state: 'no_reviews', value: null }
              : { comparison: null, source: 'payload', state: 'available', value: reviewValues.average }
            : { comparison: null, source: 'payload', state: payloadState, value: null },
          count: reviewValues
            ? { comparison: null, source: 'payload', state: 'available', value: reviewValues.count }
            : { comparison: null, source: 'payload', state: payloadState, value: null },
          source: 'payload',
        },
        sessionConversion: sessionMetric(posthogResult),
      },
      period: windows.current,
      schemaVersion: CLINIC_DASHBOARD_REPORTING_SCHEMA_VERSION,
      timezone: ISTANBUL_TIME_ZONE,
    },
  }
}

export const parseReportingPeriodDays = (value: string | undefined): ReportingPeriodDays | undefined => {
  const parsed = typeof value === 'string' && /^(?:7|30|90)$/u.test(value) ? Number(value) : Number.NaN
  return REPORTING_PERIOD_DAYS.includes(parsed as ReportingPeriodDays) ? (parsed as ReportingPeriodDays) : undefined
}
