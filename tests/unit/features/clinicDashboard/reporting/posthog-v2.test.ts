import { afterEach, describe, expect, it, vi } from 'vitest'
import { readPostHogClinicDashboardReportingV2 } from '@/features/clinicDashboard/reporting/posthog-v2'
import { executeReportingQuery } from '../../../../helpers/reportingClickHouse'

const current = { days: 7 as const, from: '2026-10-25T21:00:00.000Z', to: '2026-11-01T12:00:00.000Z' }
const comparison = { days: 7 as const, from: '2026-10-18T21:00:00.000Z', to: '2026-10-25T12:00:00.000Z' }

const configure = () => {
  vi.stubEnv('POSTHOG_QUERY_API_KEY', 'synthetic-query-key')
  vi.stubEnv('POSTHOG_QUERY_PROJECT_ID', 'synthetic-project')
  vi.stubEnv('POSTHOG_QUERY_RETENTION_DAYS', '365')
  vi.stubEnv('POSTHOG_PROFILE_VIEWS_CAPTURE_STARTED_AT', '2026-01-01T00:00:00.000Z')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('five-count reporting source', () => {
  it.runIf(Boolean(process.env.REPORTING_CLICKHOUSE_CONTAINER))(
    'counts three views as one browser across sessions through the emitted production query',
    async () => {
      configure()
      vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
        const query = JSON.parse(String(init.body)).query.query as string
        const result = executeReportingQuery(query, [
          {
            timestamp: current.from,
            event: 'clinic_profile_viewed',
            distinct_id: 'browser-one',
            properties: { clinic_id: '31', $session_id: 'session-a', submission_id: 'unrelated-inquiry' },
          },
          {
            timestamp: '2026-10-27T09:00:00.000Z',
            event: 'clinic_profile_viewed',
            distinct_id: 'browser-one',
            properties: { clinic_id: '31', $session_id: 'session-b' },
          },
          {
            timestamp: current.to,
            event: 'clinic_profile_viewed',
            distinct_id: 'browser-one',
            properties: { clinic_id: '31', $session_id: 'session-c' },
          },
          {
            timestamp: current.from,
            event: 'clinic_profile_viewed',
            distinct_id: 'other-browser',
            properties: { clinic_id: '99' },
          },
          {
            timestamp: comparison.from,
            event: 'clinic_profile_viewed',
            distinct_id: 'browser-two',
            properties: { clinic_id: '31' },
          },
        ])
        return Response.json(result)
      })
      const result = await readPostHogClinicDashboardReportingV2({ clinicId: '31', comparison, current })
      expect(result.profileViews).toMatchObject({
        current: { value: 3, state: 'available' },
        comparison: { value: 1, state: 'available', absoluteDelta: 2 },
      })
      expect(result.uniqueVisitors).toMatchObject({
        current: { value: 1, state: 'available' },
        comparison: { value: 1, state: 'available', absoluteDelta: 0 },
      })
      expect(result.impressions.current).toEqual({ value: null, state: 'partial_coverage' })
      expect(result.inquiryStarters.current).toEqual({ value: null, state: 'partial_coverage' })
    },
  )

  it.runIf(Boolean(process.env.REPORTING_CLICKHOUSE_CONTAINER)).each([
    [7, '2026-03-27T21:00:00.000Z', '2026-04-03T09:15:30.123Z', '2026-04-03T21:00:00.000Z'],
    [30, '2026-02-09T21:00:00.000Z', '2026-03-11T09:15:30.123Z', '2026-03-11T21:00:00.000Z'],
    [90, '2025-10-12T21:00:00.000Z', '2026-01-10T09:15:30.123Z', '2026-01-10T21:00:00.000Z'],
  ] as const)(
    'applies every current/comparison and clinic boundary for %i days',
    async (days, previousFrom, previousTo, from) => {
      configure()
      vi.stubEnv('POSTHOG_PROFILE_VIEWS_CAPTURE_STARTED_AT', '2025-01-01T00:00:00.000Z')
      const to = '2026-04-10T09:15:30.123Z'
      const event = (timestamp: string, distinct_id: string, clinic_id = '31') => ({
        timestamp,
        event: 'clinic_profile_viewed',
        distinct_id,
        properties: { clinic_id },
      })
      vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) =>
        Response.json(
          executeReportingQuery(JSON.parse(String(init.body)).query.query, [
            event(previousFrom, 'old-one'),
            event(previousFrom, 'old-one'),
            event(previousTo, 'excluded-comparison-end'),
            event(from, 'one'),
            event(from, 'one'),
            event(to, 'one'),
            event(to, 'two'),
            event(new Date(Date.parse(previousFrom) - 1).toISOString(), 'too-old'),
            event(new Date(Date.parse(to) + 1).toISOString(), 'too-new'),
            event(to, 'different-clinic', '99'),
          ]),
        ),
      )
      const result = await readPostHogClinicDashboardReportingV2({
        clinicId: '31',
        current: { from, to, days },
        comparison: { from: previousFrom, to: previousTo, days },
      })
      expect(result.profileViews).toMatchObject({ current: { value: 4 }, comparison: { value: 2 } })
      expect(result.uniqueVisitors).toMatchObject({ current: { value: 2 }, comparison: { value: 1 } })
    },
  )

  it.runIf(Boolean(process.env.REPORTING_CLICKHOUSE_CONTAINER))(
    'keeps measured zero, new capture and retention-limited comparison distinct',
    async () => {
      configure()
      vi.stubEnv('POSTHOG_PROFILE_VIEWS_CAPTURE_STARTED_AT', current.from)
      vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) =>
        Response.json(executeReportingQuery(JSON.parse(String(init.body)).query.query, [])),
      )
      const result = await readPostHogClinicDashboardReportingV2({ clinicId: '31', comparison, current })
      expect(result.uniqueVisitors.current).toEqual({ value: 0, state: 'available' })
      expect(result.uniqueVisitors.comparison).toEqual({
        value: null,
        state: 'partial_coverage',
        absoluteDelta: null,
        relativeDeltaPercent: null,
      })
      expect(result.impressions.current).toEqual({ value: null, state: 'partial_coverage' })
      vi.stubEnv('POSTHOG_PROFILE_VIEWS_CAPTURE_STARTED_AT', '2025-01-01T00:00:00.000Z')
      vi.stubEnv('POSTHOG_QUERY_RETENTION_DAYS', '8')
      const retained = await readPostHogClinicDashboardReportingV2({ clinicId: '31', comparison, current })
      expect(retained.profileViews.current).toEqual({ value: 0, state: 'available' })
      expect(retained.profileViews.comparison.state).toBe('partial_coverage')
    },
  )

  it('ends a source outage after one request without stale values or retry', async () => {
    configure()
    const fetcher = vi.fn().mockRejectedValue(new Error('synthetic outage'))
    vi.stubGlobal('fetch', fetcher)
    const result = await readPostHogClinicDashboardReportingV2({ clinicId: '31', comparison, current })
    expect(result.uniqueVisitors.current).toEqual({ value: null, state: 'source_unavailable' })
    expect(result.profileViews.current).toEqual({ value: null, state: 'source_unavailable' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(
      'https://eu.posthog.com/api/projects/synthetic-project/query/',
      expect.objectContaining({ method: 'POST', cache: 'no-store' }),
    )
  })

  it('bounds an unresponsive source to three seconds without retry', async () => {
    configure()
    vi.useFakeTimers()
    const fetcher = vi.fn(
      (_url: unknown, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    )
    vi.stubGlobal('fetch', fetcher)
    const result = readPostHogClinicDashboardReportingV2({ clinicId: '31', comparison, current })
    await vi.advanceTimersByTimeAsync(3_000)
    expect((await result).uniqueVisitors.current).toEqual({ state: 'source_unavailable', value: null })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
