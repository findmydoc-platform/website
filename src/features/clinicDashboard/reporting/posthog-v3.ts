import { CLINIC_DASHBOARD_REPORTING_QUERY_CATALOG } from '@/posthog/api'
import type { ClinicDashboardReportingV3DTO, ReportingSourceState, ReportingPeriodDays } from './contracts'
import { countMetric } from './countMetric'
import { REPORTING_CAPTURE_STARTS_BY_PROJECT } from './config'

type AnalyticsMetric = 'impressions' | 'profileViews' | 'uniqueVisitors'
type AnalyticsCounts = Pick<ClinicDashboardReportingV3DTO['metrics'], AnalyticsMetric>
type Window = { from: string; to: string; days?: ReportingPeriodDays }
type Input = { clinicId: string; comparison: Window; current: Window }
const metrics: AnalyticsMetric[] = ['impressions', 'profileViews', 'uniqueVisitors']
const escaped = (value: string) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")

const queryInstant = (value: string) => escaped(value.replace('T', ' ').replace(/Z$/u, ''))

const queryFor = ({ clinicId, comparison, current }: Input): string => {
  const events = CLINIC_DASHBOARD_REPORTING_QUERY_CATALOG.events
  const columns = (['current', 'comparison'] as const).flatMap((window) => {
    const inWindow = `window = '${window}'`
    return [
      `countIf(event = '${events.profileViewed}' AND ${inWindow}) AS ${window}_profileViews`,
      `uniqExactIf(distinct_id, event = '${events.profileViewed}' AND ${inWindow} AND notEmpty(distinct_id)) AS ${window}_uniqueVisitors`,
      `countIf(event = '${events.searchResultViewed}' AND ${inWindow}) AS ${window}_impressions`,
      `countIf(event = '${events.profileViewed}' AND ${inWindow} AND empty(distinct_id)) AS ${window}_missingVisitors`,
    ]
  })
  return `SELECT ${columns.join(',\n')} FROM (
    SELECT event, distinct_id, if(timestamp >= toDateTime64('${queryInstant(current.from)}', 3, 'UTC'), 'current', 'comparison') AS window
    FROM events WHERE properties.clinic_id = '${escaped(clinicId)}'
      AND event IN ('${events.profileViewed}', '${events.searchResultViewed}')
      AND ((timestamp >= toDateTime64('${queryInstant(comparison.from)}', 3, 'UTC') AND timestamp < toDateTime64('${queryInstant(comparison.to)}', 3, 'UTC'))
        OR (timestamp >= toDateTime64('${queryInstant(current.from)}', 3, 'UTC') AND timestamp <= toDateTime64('${queryInstant(current.to)}', 3, 'UTC')))
  )`
}

const captureStart = (project: string, metric: AnalyticsMetric): number => {
  const events = CLINIC_DASHBOARD_REPORTING_QUERY_CATALOG.events
  const event = metric === 'impressions' ? events.searchResultViewed : events.profileViewed
  const setting = REPORTING_CAPTURE_STARTS_BY_PROJECT[project]?.[event]
  return setting && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(setting) ? Date.parse(setting) : Number.NaN
}

const coverage = (
  project: string,
  metric: AnalyticsMetric,
  window: Window,
  asOf: string,
  retention: number,
): ReportingSourceState =>
  captureStart(project, metric) <= Date.parse(window.from) &&
  Date.parse(window.from) >= Date.parse(asOf) - retention * 86_400_000
    ? 'available'
    : 'partial_coverage'

const unavailable = (): AnalyticsCounts =>
  Object.fromEntries(
    metrics.map((metric) => [metric, countMetric('posthog', null, 'source_unavailable', null, 'source_unavailable')]),
  ) as AnalyticsCounts

export async function readPostHogClinicDashboardReportingV3(input: Input): Promise<AnalyticsCounts> {
  const key = process.env.POSTHOG_QUERY_API_KEY
  const project = process.env.POSTHOG_QUERY_PROJECT_ID
  const retention = Number(process.env.POSTHOG_QUERY_RETENTION_DAYS)
  if (!key || !project || !Number.isSafeInteger(retention) || retention <= 0) return unavailable()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3_000)
  try {
    const response = await fetch(`https://eu.posthog.com/api/projects/${encodeURIComponent(project)}/query/`, {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'clinic-dashboard-reporting-v3',
        query: { kind: 'HogQLQuery', query: queryFor(input) },
        refresh: 'force_blocking',
      }),
    })
    if (!response.ok) return unavailable()
    const body: { columns?: unknown; results?: unknown } = await response.json()
    if (
      !Array.isArray(body.columns) ||
      !Array.isArray(body.results) ||
      body.results.length !== 1 ||
      !Array.isArray(body.results[0]) ||
      body.results[0].length !== body.columns.length
    )
      return unavailable()
    const row = body.results[0] as unknown[]
    const values = new Map<string, number>()
    for (const [index, column] of body.columns.entries()) {
      const value = row[index]
      if (
        typeof column !== 'string' ||
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < 0 ||
        values.has(column)
      )
        return unavailable()
      values.set(column, value)
    }
    const get = (column: string): number => {
      const value = values.get(column)
      if (value === undefined) throw new Error('Invalid aggregate response')
      return value
    }
    return Object.fromEntries(
      metrics.map((metric) => {
        const state = (window: 'current' | 'comparison'): ReportingSourceState => {
          const covered = coverage(project, metric, input[window], input.current.to, retention)
          const missing = metric === 'uniqueVisitors' ? get(`${window}_missingVisitors`) : 0
          return covered === 'available' && missing > 0 ? 'partial_coverage' : covered
        }
        return [
          metric,
          countMetric(
            'posthog',
            get(`current_${metric}`),
            state('current'),
            get(`comparison_${metric}`),
            state('comparison'),
          ),
        ]
      }),
    ) as AnalyticsCounts
  } catch {
    return unavailable()
  } finally {
    clearTimeout(timeout)
  }
}
