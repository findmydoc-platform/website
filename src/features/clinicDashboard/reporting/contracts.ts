export const CLINIC_DASHBOARD_REPORTING_SCHEMA_VERSION = 'clinic-dashboard-reporting-v1' as const

export const REPORTING_PERIOD_DAYS = [7, 30, 90] as const
export type ReportingPeriodDays = (typeof REPORTING_PERIOD_DAYS)[number]
export type ReportingMetricSource = 'payload' | 'posthog'
export type ReportingSourceState = 'available' | 'source_unavailable' | 'partial_coverage'
export type ReportingMetricState = ReportingSourceState | 'zero_denominator' | 'no_reviews'

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

export type ReportingSessionConversionMetric = {
  source: 'posthog'
  current: {
    ratePercent: number | null
    numeratorSessions: number | null
    denominatorSessions: number | null
    state: ReportingSourceState | 'zero_denominator'
  }
  comparison: {
    ratePercent: number | null
    numeratorSessions: number | null
    denominatorSessions: number | null
    state: ReportingSourceState | 'zero_denominator'
    percentagePointDelta: number | null
  }
}

export type ReportingSnapshotMetric = {
  source: 'payload'
  value: number | null
  state: ReportingMetricState
  comparison: null
}

export type ClinicDashboardReportingDTO = {
  schemaVersion: typeof CLINIC_DASHBOARD_REPORTING_SCHEMA_VERSION
  asOf: string
  timezone: 'Europe/Istanbul'
  period: {
    days: ReportingPeriodDays
    from: string
    to: string
  }
  comparisonPeriod: {
    days: ReportingPeriodDays
    from: string
    to: string
  }
  metrics: {
    profileViews: ReportingCountMetric & { source: 'posthog' }
    ctaInteractions: {
      source: 'posthog'
      total: ReportingCountMetric & { source: 'posthog' }
      byCtaId: Record<'choose_treatment' | 'contact' | 'contact_doctor', ReportingCountMetric & { source: 'posthog' }>
    }
    inquiries: ReportingCountMetric & { source: 'payload' }
    sessionConversion: ReportingSessionConversionMetric
    reviews: {
      source: 'payload'
      count: ReportingSnapshotMetric
      average: ReportingSnapshotMetric
    }
    profileCompleteness: {
      source: 'payload'
      completedAreas: number | null
      totalAreas: 6
      percent: number | null
      state: ReportingSourceState
      comparison: null
    }
  }
}
