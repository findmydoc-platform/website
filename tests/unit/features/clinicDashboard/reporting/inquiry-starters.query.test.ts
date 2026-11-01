import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readPostHogClinicDashboardReportingV2 } from '@/features/clinicDashboard/reporting/posthog-v2'
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
    clinic_inquiry_started: null,
  }
})

const configure = () => {
  vi.stubEnv('POSTHOG_QUERY_API_KEY', 'synthetic-query-key')
  vi.stubEnv('POSTHOG_QUERY_PROJECT_ID', 'synthetic-project')
  vi.stubEnv('POSTHOG_QUERY_RETENTION_DAYS', '365')
  captureStartsByProject['synthetic-project']!.clinic_profile_viewed = '2025-01-01T00:00:00.000Z'
  captureStartsByProject['synthetic-project']!.clinic_inquiry_started = '2025-01-01T00:00:00.000Z'
}
const event = (
  timestamp: string,
  distinct_id: string,
  clinic_id = '31',
  session = 'session-one',
  name = 'clinic_inquiry_started',
) => ({
  timestamp,
  event: name,
  distinct_id,
  properties: { clinic_id, $session_id: session, submission_id: 'unrelated-inquiry-id' },
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe.runIf(Boolean(process.env.REPORTING_CLICKHOUSE_CONTAINER))(
  'inquiry starters through the unchanged production query',
  () => {
    it.each([
      {
        period: 'current',
        timestamp: '2026-10-25T21:00:00.000Z',
        starters: {
          current: { state: 'partial_coverage', value: null },
          comparison: { state: 'available', value: 1, absoluteDelta: null, relativeDeltaPercent: null },
        },
      },
      {
        period: 'comparison',
        timestamp: '2026-10-18T21:00:00.000Z',
        starters: {
          current: { state: 'available', value: 1 },
          comparison: { state: 'partial_coverage', value: null, absoluteDelta: null, relativeDeltaPercent: null },
        },
      },
    ])('makes only $period starters partial when an edit has no browser identity', async (fixture) => {
      configure()
      captureStartsByProject['synthetic-project']!.clinic_search_result_viewed = '2025-01-01T00:00:00.000Z'
      const current = { from: '2026-10-25T21:00:00.000Z', to: '2026-11-01T12:00:00.000Z' }
      const comparison = { from: '2026-10-18T21:00:00.000Z', to: '2026-10-25T12:00:00.000Z' }
      vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) =>
        Response.json(
          executeReportingQuery(JSON.parse(String(init.body)).query.query, [
            ...[current.from, comparison.from].flatMap((timestamp) => [
              event(timestamp, 'recognized-browser'),
              event(timestamp, 'recognized-browser', '31', 'profile-session', 'clinic_profile_viewed'),
              event(timestamp, 'recognized-browser', '31', 'listing-session', 'clinic_search_result_viewed'),
            ]),
            event(fixture.timestamp, '', '31', 'valid-session'),
          ]),
        ),
      )
      const reporting = await readPostHogClinicDashboardReportingV2({ clinicId: '31', current, comparison })
      expect(reporting.inquiryStarters).toEqual({ source: 'posthog', ...fixture.starters })
      expect(reporting.uniqueVisitors).toEqual({
        source: 'posthog',
        current: { state: 'available', value: 1 },
        comparison: { state: 'available', value: 1, absoluteDelta: 0, relativeDeltaPercent: 0 },
      })
      expect(reporting.profileViews).toEqual({
        source: 'posthog',
        current: { state: 'available', value: 1 },
        comparison: { state: 'available', value: 1, absoluteDelta: 0, relativeDeltaPercent: 0 },
      })
      expect(reporting.impressions).toEqual({
        source: 'posthog',
        current: { state: 'available', value: 1 },
        comparison: { state: 'available', value: 1, absoluteDelta: 0, relativeDeltaPercent: 0 },
      })
    })

    it.each([
      [7, '2026-03-27T21:00:00.000Z', '2026-04-03T09:15:30.123Z', '2026-04-03T21:00:00.000Z'],
      [30, '2026-02-09T21:00:00.000Z', '2026-03-11T09:15:30.123Z', '2026-03-11T21:00:00.000Z'],
      [90, '2025-10-12T21:00:00.000Z', '2026-01-10T09:15:30.123Z', '2026-01-10T21:00:00.000Z'],
    ] as const)(
      'counts browser activity separately by clinic and both %i-day windows',
      async (days, previousFrom, previousTo, from) => {
        configure()
        const to = '2026-04-10T09:15:30.123Z'
        const events = [
          event(previousFrom, 'same-browser'),
          event(previousFrom, 'same-browser', '31', 'earlier-session'),
          event(previousTo, 'excluded-comparison-end'),
          event(from, 'same-browser', '31', 'later-session'),
          event(to, 'same-browser', '31', 'different-session'),
          event(to, 'second-browser'),
          event(to, 'same-browser', '99'),
          event(to, 'third-browser', '99'),
          event(new Date(Date.parse(previousFrom) - 1).toISOString(), 'too-old'),
          event(new Date(Date.parse(to) + 1).toISOString(), 'too-new'),
          event(previousFrom, 'began-before-current'),
          event(to, 'patient_inquiry:stored-later', '31', 'new-submission-session', 'patient_inquiry_created'),
        ]
        const source = vi.fn(async (_url: unknown, init: RequestInit) =>
          Response.json(executeReportingQuery(JSON.parse(String(init.body)).query.query, events)),
        )
        vi.stubGlobal('fetch', source)
        const input = {
          clinicId: '31',
          current: { from, to, days },
          comparison: { from: previousFrom, to: previousTo, days },
        }
        const reporting = await readPostHogClinicDashboardReportingV2(input)
        expect(reporting.inquiryStarters).toMatchObject({
          current: { state: 'available', value: 2 },
          comparison: { state: 'available', value: 2, absoluteDelta: 0 },
        })
        expect(reporting.uniqueVisitors.current.value).toBe(0)
        expect(source).toHaveBeenCalledTimes(1)
        const otherClinic = await readPostHogClinicDashboardReportingV2({ ...input, clinicId: '99' })
        expect(otherClinic.inquiryStarters.current).toEqual({ state: 'available', value: 2 })
      },
    )

    it('preserves a measured zero and current value while rejecting unknown current or comparison history', async () => {
      configure()
      const current = { from: '2026-10-25T21:00:00.000Z', to: '2026-11-01T12:00:00.000Z' }
      const comparison = { from: '2026-10-18T21:00:00.000Z', to: '2026-10-25T12:00:00.000Z' }
      vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) =>
        Response.json(executeReportingQuery(JSON.parse(String(init.body)).query.query, [])),
      )
      captureStartsByProject['synthetic-project']!.clinic_inquiry_started = current.from
      let reporting = await readPostHogClinicDashboardReportingV2({ clinicId: '31', current, comparison })
      expect(reporting.inquiryStarters.current).toEqual({ state: 'available', value: 0 })
      expect(reporting.inquiryStarters.comparison).toEqual({
        state: 'partial_coverage',
        value: null,
        absoluteDelta: null,
        relativeDeltaPercent: null,
      })
      captureStartsByProject['synthetic-project']!.clinic_inquiry_started = current.to
      reporting = await readPostHogClinicDashboardReportingV2({ clinicId: '31', current, comparison })
      expect(reporting.inquiryStarters.current).toEqual({ state: 'partial_coverage', value: null })
      captureStartsByProject['synthetic-project']!.clinic_inquiry_started = null
      reporting = await readPostHogClinicDashboardReportingV2({ clinicId: '31', current, comparison })
      expect(reporting.inquiryStarters.current).toEqual({ state: 'partial_coverage', value: null })
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('synthetic outage')))
      reporting = await readPostHogClinicDashboardReportingV2({ clinicId: '31', current, comparison })
      expect(reporting.inquiryStarters.current).toEqual({ state: 'source_unavailable', value: null })
    })
  },
)
