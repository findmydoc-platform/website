export type ReportingCaptureStarts = {
  clinic_profile_viewed: string | null
  clinic_search_result_viewed: string | null
}

// Key entries by POSTHOG_QUERY_PROJECT_ID and use verified UTC instants with milliseconds.
// Each event has its own continuous capture start; null or an absent project means unknown coverage.
// Profile Views and Unique Visitors share clinic_profile_viewed. First observed activity alone is not proof.
// Leave a project absent until its capture provenance has been verified.
export const REPORTING_CAPTURE_STARTS_BY_PROJECT: Readonly<
  Record<string, Readonly<ReportingCaptureStarts> | undefined>
> = {}
