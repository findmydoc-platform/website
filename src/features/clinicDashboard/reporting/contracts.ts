export const REPORTING_PERIOD_DAYS = [7, 30, 90] as const
export type ReportingPeriodDays = (typeof REPORTING_PERIOD_DAYS)[number]
export type ReportingMetricSource = 'payload' | 'posthog'
export type ReportingSourceState = 'available' | 'source_unavailable' | 'partial_coverage'

export type ReportingMetricValue = {
  value: number | null
  state: ReportingSourceState
}

export type ReportingCountMetric = {
  source: ReportingMetricSource
  current: ReportingMetricValue
  comparison: ReportingMetricValue & {
    absoluteDelta: number | null
    relativeDeltaPercent: number | null
  }
}

export type ReportingReviewCountSnapshot = {
  source: 'payload'
  value: number | null
  state: ReportingSourceState
  comparison: null
}

export type ReportingReviewAverageSnapshot = {
  source: 'payload'
  value: number | null
  state: ReportingSourceState | 'no_reviews'
  comparison: null
}

export const CLINIC_DASHBOARD_REPORTING_V3_SCHEMA_VERSION = 'clinic-dashboard-reporting-v3' as const
export const REPORTING_CONTENT_CONTRACT_HEADER = 'X-Findmydoc-Reporting-Contract' as const

export type ClinicDashboardReportingV3DTO = {
  schemaVersion: typeof CLINIC_DASHBOARD_REPORTING_V3_SCHEMA_VERSION
  asOf: string
  timezone: 'Europe/Istanbul'
  period: { days: ReportingPeriodDays; from: string; to: string }
  comparisonPeriod: { days: ReportingPeriodDays; from: string; to: string }
  metrics: {
    impressions: ReportingCountMetric & { source: 'posthog' }
    profileViews: ReportingCountMetric & { source: 'posthog' }
    uniqueVisitors: ReportingCountMetric & { source: 'posthog' }
    inquiries: ReportingCountMetric & { source: 'payload' }
    reviews: {
      source: 'payload'
      count: ReportingReviewCountSnapshot
      average: ReportingReviewAverageSnapshot
    }
  }
}
