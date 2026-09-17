import type { ReportingPeriodDays, ReportingSourceState } from './contracts'

const POSTHOG_QUERY_TIMEOUT_MS = 3_000
const POSTHOG_DAY_MS = 86_400_000
const POSTHOG_QUERY_HOST = 'https://eu.i.posthog.com'

type ReportingWindow = {
  from: string
  to: string
}

export type PostHogReportingValues = {
  ctaById: Record<'choose_treatment' | 'contact' | 'contact_doctor', number>
  ctaTotal: number
  inquirySessions: number
  missingCorrelationEvents: number
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
  ctaById: { choose_treatment: 0, contact: 0, contact_doctor: 0 },
  ctaTotal: 0,
  inquirySessions: 0,
  missingCorrelationEvents: 0,
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
  const chooseTreatment = value('cta_choose_treatment')
  const contact = value('cta_contact')
  const contactDoctor = value('cta_contact_doctor')
  const profileViewSessions = value('profile_view_sessions')
  const inquirySessions = value('inquiry_sessions')
  const missingCorrelationEvents = value('missing_correlation_events')

  if (
    profileViews === undefined ||
    ctaTotal === undefined ||
    chooseTreatment === undefined ||
    contact === undefined ||
    contactDoctor === undefined ||
    profileViewSessions === undefined ||
    inquirySessions === undefined ||
    missingCorrelationEvents === undefined
  ) {
    return undefined
  }

  return {
    ctaById: {
      choose_treatment: chooseTreatment,
      contact,
      contact_doctor: contactDoctor,
    },
    ctaTotal,
    inquirySessions,
    missingCorrelationEvents,
    profileViews,
    profileViewSessions,
  }
}

const escapeHogQLString = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")

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
  const currentFrom = escapeHogQLString(current.from)
  const asOf = escapeHogQLString(current.to)

  return `
WITH filtered_events AS (
  SELECT
    event,
    timestamp,
    properties.cta_id AS cta_id,
    properties.$session_id AS session_id,
    if(timestamp >= toDateTime64('${currentFrom}', 3), 'current', 'comparison') AS window
  FROM events
  WHERE timestamp >= toDateTime64('${comparisonFrom}', 3)
    AND timestamp <= toDateTime64('${asOf}', 3)
    AND properties.clinic_id = '${clinic}'
    AND event IN ('clinic_profile_viewed', 'clinic_cta_clicked', 'patient_inquiry_created')
), sessions AS (
  SELECT
    window,
    session_id,
    minIf(timestamp, event = 'clinic_profile_viewed') AS profile_viewed_at,
    minIf(timestamp, event = 'patient_inquiry_created') AS inquiry_created_at
  FROM filtered_events
  WHERE session_id IS NOT NULL AND session_id != ''
  GROUP BY window, session_id
)
SELECT
  countIf(event = 'clinic_profile_viewed' AND window = 'current') AS current_profile_views,
  countIf(event = 'clinic_cta_clicked' AND window = 'current') AS current_cta_total,
  countIf(event = 'clinic_cta_clicked' AND cta_id = 'choose_treatment' AND window = 'current') AS current_cta_choose_treatment,
  countIf(event = 'clinic_cta_clicked' AND cta_id = 'contact' AND window = 'current') AS current_cta_contact,
  countIf(event = 'clinic_cta_clicked' AND cta_id = 'contact_doctor' AND window = 'current') AS current_cta_contact_doctor,
  countIf(event = 'patient_inquiry_created' AND window = 'current' AND (session_id IS NULL OR session_id = '')) AS current_missing_correlation_events,
  countIf(event = 'clinic_profile_viewed' AND window = 'comparison') AS comparison_profile_views,
  countIf(event = 'clinic_cta_clicked' AND window = 'comparison') AS comparison_cta_total,
  countIf(event = 'clinic_cta_clicked' AND cta_id = 'choose_treatment' AND window = 'comparison') AS comparison_cta_choose_treatment,
  countIf(event = 'clinic_cta_clicked' AND cta_id = 'contact' AND window = 'comparison') AS comparison_cta_contact,
  countIf(event = 'clinic_cta_clicked' AND cta_id = 'contact_doctor' AND window = 'comparison') AS comparison_cta_contact_doctor,
  countIf(event = 'patient_inquiry_created' AND window = 'comparison' AND (session_id IS NULL OR session_id = '')) AS comparison_missing_correlation_events,
  (SELECT countIf(profile_viewed_at IS NOT NULL) FROM sessions WHERE window = 'current') AS current_profile_view_sessions,
  (SELECT countIf(profile_viewed_at IS NOT NULL AND inquiry_created_at >= profile_viewed_at) FROM sessions WHERE window = 'current') AS current_inquiry_sessions,
  (SELECT countIf(profile_viewed_at IS NOT NULL) FROM sessions WHERE window = 'comparison') AS comparison_profile_view_sessions,
  (SELECT countIf(profile_viewed_at IS NOT NULL AND inquiry_created_at >= profile_viewed_at) FROM sessions WHERE window = 'comparison') AS comparison_inquiry_sessions
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
    const response = await fetch(
      `${process.env.POSTHOG_QUERY_HOST ?? POSTHOG_QUERY_HOST}/api/projects/${encodeURIComponent(projectId)}/query/`,
      {
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
      },
    )
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
