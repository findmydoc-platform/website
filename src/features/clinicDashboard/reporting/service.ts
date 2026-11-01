import { revalidateClinicDashboardTargetRequest } from '@/features/clinicDashboard/authorization'
import type { PayloadRequest, Where } from 'payload'
import {
  CLINIC_DASHBOARD_REPORTING_V2_SCHEMA_VERSION,
  type ClinicDashboardReportingV2DTO,
  REPORTING_PERIOD_DAYS,
  type ReportingPeriodDays,
} from './contracts'
import { countMetric } from './countMetric'

import { readPostHogClinicDashboardReportingV2 } from './posthog-v2'

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
  | { status: 'success'; data: ClinicDashboardReportingV2DTO }
  | { status: 'unauthorized' }
  | { status: 'access-denied' }
  | { status: 'unavailable' }

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const relationId = (value: unknown): number | string | undefined => {
  if (typeof value === 'number' || typeof value === 'string') return value
  return isRecord(value) && (typeof value.id === 'number' || typeof value.id === 'string') ? value.id : undefined
}

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

const isInWindow = (date: unknown, window: ReportingWindow, endInclusive: boolean): boolean => {
  const parsed = typeof date === 'string' ? Date.parse(date) : Number.NaN
  const windowEnd = Date.parse(window.to)
  return (
    Number.isFinite(parsed) &&
    parsed >= Date.parse(window.from) &&
    (endInclusive ? parsed <= windowEnd : parsed < windowEnd)
  )
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
    comparison: inquiries.filter((inquiry) => isInWindow(inquiry.createdAt, windows.comparison, false)).length,
    current: inquiries.filter((inquiry) => isInWindow(inquiry.createdAt, windows.current, true)).length,
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

const resolveClinic = async (req: PayloadRequest, clinicId: string): Promise<RecordValue | null> => {
  const result = await req.payload.find({
    collection: 'clinics',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    select: { address: true },
    where: { id: { equals: clinicId } },
  })
  const clinic = result.docs[0]
  return isRecord(clinic) && String(clinic.id) === clinicId ? clinic : null
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

export const parseReportingPeriodDays = (value: string | undefined): ReportingPeriodDays | undefined => {
  const parsed = typeof value === 'string' && /^(?:7|30|90)$/u.test(value) ? Number(value) : Number.NaN
  return REPORTING_PERIOD_DAYS.includes(parsed as ReportingPeriodDays) ? (parsed as ReportingPeriodDays) : undefined
}

export async function resolveClinicDashboardReportingV2(
  req: PayloadRequest,
  targetClinicId: string,
  periodDays: ReportingPeriodDays,
  now = new Date(),
): Promise<ClinicDashboardReportingResult> {
  const access = await revalidateClinicDashboardTargetRequest(req, targetClinicId)
  if (access.status !== 'authorized') return access
  const clinicId = access.clinicId
  const windows = createReportingWindows(periodDays, now)
  try {
    const clinic = await resolveClinic(req, clinicId)
    if (!clinic || !(await isTürkiyeClinic(req, clinic))) return { status: 'access-denied' }
  } catch {
    return { status: 'unavailable' }
  }
  const [inquiries, reviews, analytics] = await Promise.all([
    resolveInquiryMetrics(req, clinicId, windows).catch(() => undefined),
    resolveReviews(req, clinicId).catch(() => undefined),
    readPostHogClinicDashboardReportingV2({ clinicId, comparison: windows.comparison, current: windows.current }),
  ])
  return {
    status: 'success',
    data: {
      schemaVersion: CLINIC_DASHBOARD_REPORTING_V2_SCHEMA_VERSION,
      asOf: windows.asOf,
      timezone: ISTANBUL_TIME_ZONE,
      period: windows.current,
      comparisonPeriod: windows.comparison,
      metrics: {
        ...analytics,
        inquiries: countMetric(
          'payload',
          inquiries?.current,
          inquiries ? 'available' : 'source_unavailable',
          inquiries?.comparison,
          inquiries ? 'available' : 'source_unavailable',
        ) as ClinicDashboardReportingV2DTO['metrics']['inquiries'],
        reviews: {
          source: 'payload',
          count: {
            source: 'payload',
            comparison: null,
            state: reviews ? 'available' : 'source_unavailable',
            value: reviews?.count ?? null,
          },
          average: {
            source: 'payload',
            comparison: null,
            state: !reviews ? 'source_unavailable' : reviews.count === 0 ? 'no_reviews' : 'available',
            value: reviews && reviews.count > 0 ? reviews.average : null,
          },
        },
      },
    },
  }
}
