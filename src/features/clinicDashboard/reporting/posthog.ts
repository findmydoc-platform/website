import { CLINIC_DASHBOARD_REPORTING_QUERY_CATALOG, type ClinicDashboardReportingCtaId } from '@/posthog/api'
import type { ReportingPeriodDays, ReportingSourceState } from './contracts'

const POSTHOG_QUERY_TIMEOUT_MS = 3_000
const POSTHOG_DAY_MS = 86_400_000
const POSTHOG_QUERY_HOST = 'https://eu.i.posthog.com'

type ReportingWindow = {
  from: string
  to: string
}

export type PostHogReportingValues = {
  ctaById: Record<ClinicDashboardReportingCtaId, number>
  ctaTotal: number
  inquirySessions: number
  incompleteInquirySessionIds: number
  incompleteProfileViewSessionIds: number
  profileViews: number
  profileViewSessions: number
}

export type PostHogReportingRead = {
  comparison: PostHogReportingValues
  comparisonState: ReportingSourceState
  current: PostHogReportingValues
  currentState: ReportingSourceState
}

type ReportingQueryColumns = Record<string, number>

const emptyValues = (): PostHogReportingValues => ({
  ctaById: Object.fromEntries(CLINIC_DASHBOARD_REPORTING_QUERY_CATALOG.ctaIds.map((ctaId) => [ctaId, 0])) as Record<
    ClinicDashboardReportingCtaId,
    number
  >,
  ctaTotal: 0,
  inquirySessions: 0,
  incompleteInquirySessionIds: 0,
  incompleteProfileViewSessionIds: 0,
  profileViews: 0,
  profileViewSessions: 0,
})

const finiteNonNegativeInteger = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined

const toQueryValue = (columns: ReportingQueryColumns, field: string): number | undefined =>
  finiteNonNegativeInteger(columns[field])

const parseQueryRow = (body: unknown): ReportingQueryColumns | undefined => {
  if (!body || typeof body !== 'object') return undefined
  const response = body as { columns?: unknown; results?: unknown }
  if (!Array.isArray(response.columns) || !Array.isArray(response.results) || response.results.length !== 1)
    return undefined

  const row = response.results[0]
  if (!Array.isArray(row) || row.length !== response.columns.length) return undefined
  const columns: ReportingQueryColumns = {}
  for (const [index, name] of response.columns.entries()) {
    if (typeof name !== 'string') return undefined
    const value = finiteNonNegativeInteger(row[index])
    if (value === undefined) return undefined
    columns[name] = value
  }
  return columns
}

const asValues = (
  columns: ReportingQueryColumns,
  prefix: 'current' | 'comparison',
): PostHogReportingValues | undefined => {
  const value = (field: string) => toQueryValue(columns, `${prefix}_${field}`)
  const profileViews = value('profile_views')
  const ctaTotal = value('cta_total')
  const ctaById = Object.fromEntries(
    CLINIC_DASHBOARD_REPORTING_QUERY_CATALOG.ctaIds.map((ctaId) => [ctaId, value(`cta_${ctaId}`)]),
  ) as Record<ClinicDashboardReportingCtaId, number | undefined>
  const profileViewSessions = value('profile_view_sessions')
  const inquirySessions = value('inquiry_sessions')
  const incompleteInquirySessionIds = value('incomplete_inquiry_session_ids')
  const incompleteProfileViewSessionIds = value('incomplete_profile_view_session_ids')

  if (
    profileViews === undefined ||
    ctaTotal === undefined ||
    CLINIC_DASHBOARD_REPORTING_QUERY_CATALOG.ctaIds.some((ctaId) => ctaById[ctaId] === undefined) ||
    profileViewSessions === undefined ||
    inquirySessions === undefined ||
    incompleteInquirySessionIds === undefined ||
    incompleteProfileViewSessionIds === undefined
  ) {
    return undefined
  }

  return {
    ctaById: ctaById as Record<ClinicDashboardReportingCtaId, number>,
    ctaTotal,
    inquirySessions,
    incompleteInquirySessionIds,
    incompleteProfileViewSessionIds,
    profileViews,
    profileViewSessions,
  }
}

const escapeHogQLString = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const ctaCountColumns = (window: 'comparison' | 'current', ctaClickedEvent: string): string =>
  CLINIC_DASHBOARD_REPORTING_QUERY_CATALOG.ctaIds
    .map(
      (ctaId) =>
        `  countIf(event = '${ctaClickedEvent}' AND cta_id = '${escapeHogQLString(ctaId)}' AND window = '${window}') AS ${window}_cta_${ctaId},`,
    )
    .join('\n')

const buildQuery = ({
  clinicId,
  comparison,
  current,
}: {
  clinicId: string
  comparison: ReportingWindow
  current: ReportingWindow
}): string => {
  const clinic = escapeHogQLString(clinicId)
  const comparisonFrom = escapeHogQLString(comparison.from)
  const comparisonTo = escapeHogQLString(comparison.to)
  const currentFrom = escapeHogQLString(current.from)
  const asOf = escapeHogQLString(current.to)
  const profileViewedEvent = escapeHogQLString(CLINIC_DASHBOARD_REPORTING_QUERY_CATALOG.events.profileViewed)
  const ctaClickedEvent = escapeHogQLString(CLINIC_DASHBOARD_REPORTING_QUERY_CATALOG.events.ctaClicked)
  const patientInquiryCreatedEvent = escapeHogQLString(
    CLINIC_DASHBOARD_REPORTING_QUERY_CATALOG.events.patientInquiryCreated,
  )

  return `
WITH filtered_events AS (
  SELECT
    event,
    timestamp,
    properties.cta_id AS cta_id,
    coalesce(toString(properties.$session_id), '') AS session_id,
    if(timestamp >= toDateTime64('${currentFrom}', 3), 'current', 'comparison') AS window
  FROM events
  WHERE (
      (timestamp >= toDateTime64('${comparisonFrom}', 3) AND timestamp < toDateTime64('${comparisonTo}', 3))
      OR (timestamp >= toDateTime64('${currentFrom}', 3) AND timestamp <= toDateTime64('${asOf}', 3))
    )
    AND properties.clinic_id = '${clinic}'
    AND event IN ('${profileViewedEvent}', '${ctaClickedEvent}', '${patientInquiryCreatedEvent}')
), sessions AS (
  SELECT
    window,
    session_id,
    countIf(event = '${profileViewedEvent}') AS profile_view_count,
    countIf(event = '${patientInquiryCreatedEvent}') AS inquiry_count
  FROM filtered_events
  WHERE match(session_id, '^[A-Za-z0-9_-]{1,128}$')
  GROUP BY window, session_id
), conversion_sessions AS (
  SELECT
    profile_view.window AS window,
    profile_view.session_id AS session_id
  FROM filtered_events AS profile_view
  INNER JOIN filtered_events AS inquiry
    ON profile_view.window = inquiry.window
    AND profile_view.session_id = inquiry.session_id
  WHERE match(profile_view.session_id, '^[A-Za-z0-9_-]{1,128}$')
    AND profile_view.event = '${profileViewedEvent}'
    AND inquiry.event = '${patientInquiryCreatedEvent}'
    AND profile_view.timestamp < inquiry.timestamp
  GROUP BY profile_view.window, profile_view.session_id
)
SELECT
  countIf(event = '${profileViewedEvent}' AND window = 'current') AS current_profile_views,
  countIf(event = '${ctaClickedEvent}' AND window = 'current') AS current_cta_total,
${ctaCountColumns('current', ctaClickedEvent)}
  countIf(event = '${profileViewedEvent}' AND window = 'current' AND NOT match(session_id, '^[A-Za-z0-9_-]{1,128}$')) AS current_incomplete_profile_view_session_ids,
  countIf(event = '${patientInquiryCreatedEvent}' AND window = 'current' AND NOT match(session_id, '^[A-Za-z0-9_-]{1,128}$')) AS current_incomplete_inquiry_session_ids,
  countIf(event = '${profileViewedEvent}' AND window = 'comparison') AS comparison_profile_views,
  countIf(event = '${ctaClickedEvent}' AND window = 'comparison') AS comparison_cta_total,
${ctaCountColumns('comparison', ctaClickedEvent)}
  countIf(event = '${profileViewedEvent}' AND window = 'comparison' AND NOT match(session_id, '^[A-Za-z0-9_-]{1,128}$')) AS comparison_incomplete_profile_view_session_ids,
  countIf(event = '${patientInquiryCreatedEvent}' AND window = 'comparison' AND NOT match(session_id, '^[A-Za-z0-9_-]{1,128}$')) AS comparison_incomplete_inquiry_session_ids,
  (SELECT countIf(profile_view_count > 0) FROM sessions WHERE window = 'current') AS current_profile_view_sessions,
  (SELECT count() FROM conversion_sessions WHERE window = 'current') AS current_inquiry_sessions,
  (SELECT countIf(profile_view_count > 0) FROM sessions WHERE window = 'comparison') AS comparison_profile_view_sessions,
  (SELECT count() FROM conversion_sessions WHERE window = 'comparison') AS comparison_inquiry_sessions
FROM filtered_events
`
}

const configuredRetentionDays = (): number | undefined => {
  const value = Number(process.env.POSTHOG_QUERY_RETENTION_DAYS)
  return Number.isSafeInteger(value) && value > 0 ? value : undefined
}

const stateForWindow = (window: ReportingWindow, asOf: string, retentionDays: number): ReportingSourceState => {
  const coverageDays = Math.ceil((Date.parse(asOf) - Date.parse(window.from)) / POSTHOG_DAY_MS)
  return coverageDays <= retentionDays ? 'available' : 'partial_coverage'
}

export const readPostHogClinicDashboardReporting = async ({
  clinicId,
  comparison,
  current,
}: {
  clinicId: string
  comparison: ReportingWindow & { days: ReportingPeriodDays }
  current: ReportingWindow & { days: ReportingPeriodDays }
}): Promise<PostHogReportingRead> => {
  const apiKey = process.env.POSTHOG_QUERY_API_KEY
  const projectId = process.env.POSTHOG_QUERY_PROJECT_ID
  const retentionDays = configuredRetentionDays()
  if (!apiKey || !projectId || !retentionDays) {
    return {
      comparison: emptyValues(),
      comparisonState: 'source_unavailable',
      current: emptyValues(),
      currentState: 'source_unavailable',
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), POSTHOG_QUERY_TIMEOUT_MS)
  try {
    const response = await fetch(`${POSTHOG_QUERY_HOST}/api/projects/${encodeURIComponent(projectId)}/query/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        name: 'clinic-dashboard-reporting-v1',
        query: { kind: 'HogQLQuery', query: buildQuery({ clinicId, comparison, current }) },
        refresh: 'force_blocking',
      }),
    })
    if (!response.ok) throw new Error('PostHog reporting query failed')
    const columns = parseQueryRow(await response.json())
    const currentValues = columns ? asValues(columns, 'current') : undefined
    const comparisonValues = columns ? asValues(columns, 'comparison') : undefined
    if (!currentValues || !comparisonValues) throw new Error('PostHog reporting query returned an invalid shape')

    return {
      comparison: comparisonValues,
      comparisonState: stateForWindow(comparison, current.to, retentionDays),
      current: currentValues,
      currentState: stateForWindow(current, current.to, retentionDays),
    }
  } catch {
    return {
      comparison: emptyValues(),
      comparisonState: 'source_unavailable',
      current: emptyValues(),
      currentState: 'source_unavailable',
    }
  } finally {
    clearTimeout(timeout)
  }
}
