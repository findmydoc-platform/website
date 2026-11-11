import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readPostHogClinicDashboardReportingV3 } from '@/features/clinicDashboard/reporting/posthog-v3'
import { executeReportingQuery } from '../../../../helpers/reportingClickHouse'

import type { ReportingCaptureStarts } from '@/features/clinicDashboard/reporting/config'

const { captureStartsByProject } = vi.hoisted(() => ({
  captureStartsByProject: {} as Record<string, ReportingCaptureStarts>,
}))
vi.mock('@/features/clinicDashboard/reporting/config', () => ({
  REPORTING_CAPTURE_STARTS_BY_PROJECT: captureStartsByProject,
}))
beforeEach(() => {
  for (const project of Object.keys(captureStartsByProject)) delete captureStartsByProject[project]
  captureStartsByProject['synthetic-project'] = {
    clinic_profile_viewed: null,
    clinic_search_result_viewed: null,
  }
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it.runIf(Boolean(process.env.REPORTING_CLICKHOUSE_CONTAINER))(
  'keeps historical retired events out of the executed four-count query',
  async () => {
    vi.stubEnv('POSTHOG_QUERY_API_KEY', 'synthetic-query-key')
    vi.stubEnv('POSTHOG_QUERY_PROJECT_ID', 'synthetic-project')
    vi.stubEnv('POSTHOG_QUERY_RETENTION_DAYS', '365')
    Object.assign(captureStartsByProject['synthetic-project']!, {
      clinic_profile_viewed: '2026-01-01T00:00:00.000Z',
      clinic_search_result_viewed: '2026-01-01T00:00:00.000Z',
    })
    const current = { from: '2026-10-25T21:00:00.000Z', to: '2026-11-01T12:00:00.000Z' }
    const comparison = { from: '2026-10-18T21:00:00.000Z', to: '2026-10-25T12:00:00.000Z' }
    const row = (event: string, timestamp = current.from) => ({
      timestamp,
      event,
      distinct_id: 'browser-one',
      properties: { clinic_id: '31', $session_id: 'legacy-session' },
    })
    vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
      const emittedQuery = JSON.parse(String(init.body)).query.query as string
      const result = executeReportingQuery(emittedQuery, [
        row('clinic_profile_viewed'),
        row('clinic_profile_viewed'),
        row('clinic_cta_clicked'),
        row('clinic_inquiry_started'),
        row('patient_inquiry_created', '2026-10-26T10:00:00.000Z'),
        row('clinic_cta_clicked', comparison.from),
        row('patient_inquiry_created', comparison.from),
      ])
      expect([...result.columns].sort()).toEqual([
        'comparison_impressions',
        'comparison_missingVisitors',
        'comparison_profileViews',
        'comparison_uniqueVisitors',
        'current_impressions',
        'current_missingVisitors',
        'current_profileViews',
        'current_uniqueVisitors',
      ])
      return Response.json(result)
    })
    const result = await readPostHogClinicDashboardReportingV3({ clinicId: '31', current, comparison })
    expect(result.profileViews.current).toEqual({ value: 2, state: 'available' })
    expect(result.uniqueVisitors.current).toEqual({ value: 1, state: 'available' })
    expect(result.impressions.current).toEqual({ value: 0, state: 'available' })
    expect(result.profileViews.comparison).toEqual({
      value: 0,
      state: 'available',
      absoluteDelta: 2,
      relativeDeltaPercent: null,
    })
  },
)
