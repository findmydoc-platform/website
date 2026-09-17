import { afterEach, describe, expect, it, vi } from 'vitest'
import { readPostHogClinicDashboardReporting } from '@/features/clinicDashboard/reporting/posthog'

const originalFetch = global.fetch

const queryResponse = {
  columns: [
    'current_profile_views',
    'current_cta_total',
    'current_cta_choose_treatment',
    'current_cta_contact',
    'current_cta_contact_doctor',
    'current_incomplete_profile_view_session_ids',
    'current_incomplete_inquiry_session_ids',
    'comparison_profile_views',
    'comparison_cta_total',
    'comparison_cta_choose_treatment',
    'comparison_cta_contact',
    'comparison_cta_contact_doctor',
    'comparison_incomplete_profile_view_session_ids',
    'comparison_incomplete_inquiry_session_ids',
    'current_profile_view_sessions',
    'current_inquiry_sessions',
    'comparison_profile_view_sessions',
    'comparison_inquiry_sessions',
  ],
  results: [[20, 12, 3, 4, 5, 0, 0, 10, 9, 2, 3, 4, 0, 0, 4, 2, 2, 1]],
}

const input = {
  clinicId: '8',
  comparison: { days: 7 as const, from: '2026-03-27T21:00:00.000Z', to: '2026-04-03T09:15:30.123Z' },
  current: { days: 7 as const, from: '2026-04-03T21:00:00.000Z', to: '2026-04-10T09:15:30.123Z' },
}

describe('Clinic Dashboard PostHog reporting adapter', () => {
  afterEach(() => {
    global.fetch = originalFetch
    vi.unstubAllEnvs()
  })

  it('makes one fresh, server-only aggregate query without retrying', async () => {
    vi.stubEnv('POSTHOG_QUERY_API_KEY', 'phx_server_only')
    vi.stubEnv('POSTHOG_QUERY_PROJECT_ID', '42')
    vi.stubEnv('POSTHOG_QUERY_RETENTION_DAYS', '180')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(queryResponse), { status: 200 }))
    global.fetch = fetchMock

    const result = await readPostHogClinicDashboardReporting(input)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://eu.i.posthog.com/api/projects/42/query/',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer phx_server_only' }),
        method: 'POST',
      }),
    )
    const [, options] = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0] ?? []
    const body = JSON.parse(String(options?.body))
    expect(body).toMatchObject({
      name: 'clinic-dashboard-reporting-v1',
      query: { kind: 'HogQLQuery' },
      refresh: 'force_blocking',
    })
    expect(body.query.query).toContain("properties.clinic_id = '8'")
    expect(body.query.query).toContain(
      "timestamp >= toDateTime64('2026-03-27T21:00:00.000Z', 3) AND timestamp < toDateTime64('2026-04-03T09:15:30.123Z', 3)",
    )
    expect(body.query.query).toContain(
      "timestamp >= toDateTime64('2026-04-03T21:00:00.000Z', 3) AND timestamp <= toDateTime64('2026-04-10T09:15:30.123Z', 3)",
    )
    expect(result).toMatchObject({
      comparison: { profileViews: 10 },
      comparisonState: 'available',
      current: { ctaTotal: 12, profileViews: 20 },
      currentState: 'available',
    })
  })

  it('excludes the comparison-to/current-from gap and separately records incomplete funnel correlation for both events', async () => {
    vi.stubEnv('POSTHOG_QUERY_API_KEY', 'phx_server_only')
    vi.stubEnv('POSTHOG_QUERY_PROJECT_ID', '42')
    vi.stubEnv('POSTHOG_QUERY_RETENTION_DAYS', '180')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(queryResponse), { status: 200 }))
    global.fetch = fetchMock

    await readPostHogClinicDashboardReporting(input)

    const [, options] = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)[0] ?? []
    const query = JSON.parse(String(options?.body)).query.query as string
    expect(query).toContain(
      "(timestamp >= toDateTime64('2026-03-27T21:00:00.000Z', 3) AND timestamp < toDateTime64('2026-04-03T09:15:30.123Z', 3))",
    )
    expect(query).toContain(
      "(timestamp >= toDateTime64('2026-04-03T21:00:00.000Z', 3) AND timestamp <= toDateTime64('2026-04-10T09:15:30.123Z', 3))",
    )
    expect(query).toContain("if(timestamp >= toDateTime64('2026-04-03T21:00:00.000Z', 3), 'current', 'comparison')")
    expect(query).toContain(
      "event = 'clinic_profile_viewed' AND window = 'current' AND NOT match(session_id, '^[A-Za-z0-9_-]{1,128}$')",
    )
    expect(query).toContain("coalesce(toString(properties.$session_id), '') AS session_id")
    expect(query).toContain(
      "event = 'patient_inquiry_created' AND window = 'current' AND NOT match(session_id, '^[A-Za-z0-9_-]{1,128}$')",
    )
    expect(query).toContain(
      "event = 'clinic_profile_viewed' AND window = 'comparison' AND NOT match(session_id, '^[A-Za-z0-9_-]{1,128}$')",
    )
    expect(query).toContain(
      "event = 'patient_inquiry_created' AND window = 'comparison' AND NOT match(session_id, '^[A-Za-z0-9_-]{1,128}$')",
    )
  })

  it('represents an unavailable source as unknown rather than zero', async () => {
    vi.stubEnv('POSTHOG_QUERY_API_KEY', 'phx_server_only')
    vi.stubEnv('POSTHOG_QUERY_PROJECT_ID', '42')
    vi.stubEnv('POSTHOG_QUERY_RETENTION_DAYS', '180')
    global.fetch = vi.fn(async () => new Response('unavailable', { status: 503 }))

    const result = await readPostHogClinicDashboardReporting(input)

    expect(result).toMatchObject({
      comparison: { profileViews: 0 },
      comparisonState: 'source_unavailable',
      current: { profileViews: 0 },
      currentState: 'source_unavailable',
    })
  })

  it('marks a window beyond declared retention as partial coverage', async () => {
    vi.stubEnv('POSTHOG_QUERY_API_KEY', 'phx_server_only')
    vi.stubEnv('POSTHOG_QUERY_PROJECT_ID', '42')
    vi.stubEnv('POSTHOG_QUERY_RETENTION_DAYS', '7')
    global.fetch = vi.fn(async () => new Response(JSON.stringify(queryResponse), { status: 200 }))

    const result = await readPostHogClinicDashboardReporting(input)

    expect(result.comparisonState).toBe('partial_coverage')
    expect(result.currentState).toBe('available')
  })
})
