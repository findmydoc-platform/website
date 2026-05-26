// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
  init: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  reset: vi.fn(),
}))

vi.mock('posthog-js', () => ({
  default: posthogMock,
}))

describe('posthog client helpers', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    posthogMock.init.mockImplementation(() => undefined)
    process.env = {
      ...OLD_ENV,
      NEXT_PUBLIC_POSTHOG_KEY: 'phc_test',
      NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
    }
  })

  afterEach(() => {
    process.env = OLD_ENV
    vi.clearAllMocks()
  })

  it('does not initialize PostHog on import', async () => {
    await import('@/posthog/client')
    expect(posthogMock.init).not.toHaveBeenCalled()
  })

  it('initializes PostHog only once', async () => {
    const { initializePostHog } = await import('@/posthog/client')

    expect(initializePostHog()).toBe(true)
    expect(initializePostHog()).toBe(true)

    expect(posthogMock.init).toHaveBeenCalledTimes(1)
  })

  it('disables browser-side feature flag evaluation', async () => {
    const { initializePostHog } = await import('@/posthog/client')

    initializePostHog()

    expect(posthogMock.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        advanced_disable_feature_flags: true,
      }),
    )
  })

  it('enables and disables capturing explicitly', async () => {
    const { enablePostHog, disablePostHog } = await import('@/posthog/client')

    enablePostHog()
    disablePostHog()

    expect(posthogMock.init).toHaveBeenCalledTimes(1)
    expect(posthogMock.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false })
    expect(posthogMock.opt_out_capturing).toHaveBeenCalledTimes(1)
    expect(posthogMock.reset).toHaveBeenCalledTimes(1)
  })

  it('keeps browser event capture behind explicit consent', async () => {
    const { POSTHOG_EVENT_REGISTRY } = await import('@/posthog/events')
    const { enablePostHogAnalyticsCapture, postHogBrowserEvents } = await import('@/posthog/client-api')
    const profileViewedEvent = Object.entries(POSTHOG_EVENT_REGISTRY).find(([, definition]) =>
      definition.description.includes('public clinic profile'),
    )?.[0]

    expect(
      postHogBrowserEvents.clinicProfileViewed({
        clinic_id: '42',
        clinic_slug: 'berlin-health-clinic',
        page_path: '/clinics/berlin-health-clinic',
        source_route: 'clinic_detail',
      }),
    ).toBe(false)
    expect(posthogMock.capture).not.toHaveBeenCalled()

    expect(enablePostHogAnalyticsCapture()).toBe(true)

    expect(
      postHogBrowserEvents.clinicProfileViewed({
        clinic_id: '42',
        clinic_slug: 'berlin-health-clinic',
        page_path: '/clinics/berlin-health-clinic',
        source_route: 'clinic_detail',
      }),
    ).toBe(true)
    expect(posthogMock.capture).toHaveBeenCalledWith(profileViewedEvent, {
      clinic_id: '42',
      clinic_slug: 'berlin-health-clinic',
      page_path: '/clinics/berlin-health-clinic',
      source_route: 'clinic_detail',
    })
  })

  it('does not expose the raw PostHog browser instance', async () => {
    const clientModule = await import('@/posthog/client')

    expect(clientModule).not.toHaveProperty('posthog')
  })
})
