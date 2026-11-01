import { afterEach, describe, expect, it, vi } from 'vitest'
import { readPostHogClinicDashboardReportingV2 } from '@/features/clinicDashboard/reporting/posthog-v2'
import { executeReportingQuery } from '../../../../helpers/reportingClickHouse'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const configure = () => {
  vi.stubEnv('POSTHOG_QUERY_API_KEY', 'synthetic-query-key')
  vi.stubEnv('POSTHOG_QUERY_PROJECT_ID', 'synthetic-project')
  vi.stubEnv('POSTHOG_QUERY_RETENTION_DAYS', '365')
  vi.stubEnv('POSTHOG_IMPRESSIONS_CAPTURE_STARTED_AT', '2025-01-01T00:00:00.000Z')
}

describe.runIf(Boolean(process.env.REPORTING_CLICKHOUSE_CONTAINER))(
  'impressions through the production source query',
  () => {
    it.each([
      [7, '2026-10-25T21:00:00.000Z', '2026-10-18T21:00:00.000Z', '2026-10-25T12:00:00.000Z'],
      [30, '2026-10-02T21:00:00.000Z', '2026-09-02T21:00:00.000Z', '2026-10-02T12:00:00.000Z'],
      [90, '2026-08-03T21:00:00.000Z', '2026-05-05T21:00:00.000Z', '2026-08-03T12:00:00.000Z'],
    ] as const)(
      'counts events per clinic within both %i-day windows without visitor deduplication',
      async (days, from, previousFrom, previousTo) => {
        configure()
        const to = '2026-11-01T12:00:00.000Z'
        const event = (
          timestamp: string,
          distinct_id = 'same-browser',
          clinic_id = '31',
          event = 'clinic_search_result_viewed',
        ) => ({ timestamp, event, distinct_id, properties: { clinic_id } })
        const source = vi.fn(async (_url: unknown, init: RequestInit) => {
          expect(new Headers(init.headers).get('Authorization')).toBe('Bearer synthetic-query-key')
          const query = JSON.parse(String(init.body)).query.query as string
          return Response.json(
            executeReportingQuery(query, [
              event(previousFrom),
              event(previousFrom),
              event(previousTo),
              event(from),
              event(from),
              event(from, ''),
              event(to),
              event(new Date(Date.parse(previousFrom) - 1).toISOString()),
              event(new Date(Date.parse(to) + 1).toISOString()),
              event(to, 'other-browser', '99'),
              event(to, 'same-browser', '31', 'clinic_profile_viewed'),
            ]),
          )
        })
        vi.stubGlobal('fetch', source)
        const result = await readPostHogClinicDashboardReportingV2({
          clinicId: '31',
          current: { from, to, days },
          comparison: { from: previousFrom, to: previousTo, days },
        })
        expect(result.impressions).toEqual({
          source: 'posthog',
          current: { state: 'available', value: 4 },
          comparison: { state: 'available', value: 2, absoluteDelta: 2, relativeDeltaPercent: 100 },
        })
        expect(source).toHaveBeenCalledOnce()
      },
    )

    it('separates unknown and recent capture history, measured zero and retention for each window', async () => {
      configure()
      const input = {
        clinicId: '31',
        current: { from: '2026-10-25T21:00:00.000Z', to: '2026-11-01T12:00:00.000Z' },
        comparison: { from: '2026-10-18T21:00:00.000Z', to: '2026-10-25T12:00:00.000Z' },
      }
      vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) =>
        Response.json(executeReportingQuery(JSON.parse(String(init.body)).query.query, [])),
      )
      vi.stubEnv('POSTHOG_IMPRESSIONS_CAPTURE_STARTED_AT', '')
      const unknown = await readPostHogClinicDashboardReportingV2(input)
      expect(unknown.impressions.current).toEqual({ state: 'partial_coverage', value: null })
      expect(unknown.impressions.comparison.state).toBe('partial_coverage')
      vi.stubEnv('POSTHOG_IMPRESSIONS_CAPTURE_STARTED_AT', input.current.from)
      const recent = await readPostHogClinicDashboardReportingV2(input)
      expect(recent.impressions.current).toEqual({ state: 'available', value: 0 })
      expect(recent.impressions.comparison).toEqual({
        state: 'partial_coverage',
        value: null,
        absoluteDelta: null,
        relativeDeltaPercent: null,
      })
      vi.stubEnv('POSTHOG_IMPRESSIONS_CAPTURE_STARTED_AT', '2026-10-25T21:00:00.001Z')
      expect((await readPostHogClinicDashboardReportingV2(input)).impressions.current).toEqual({
        state: 'partial_coverage',
        value: null,
      })
      vi.stubEnv('POSTHOG_IMPRESSIONS_CAPTURE_STARTED_AT', '2025-01-01T00:00:00.000Z')
      vi.stubEnv('POSTHOG_QUERY_RETENTION_DAYS', '8')
      const retained = await readPostHogClinicDashboardReportingV2(input)
      expect(retained.impressions.current).toEqual({ state: 'available', value: 0 })
      expect(retained.impressions.comparison.state).toBe('partial_coverage')
    })
  },
)
