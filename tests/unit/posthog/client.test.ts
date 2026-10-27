// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(() => ({ event: 'synthetic' })),
  config: { token: '' },
  has_opted_in_capturing: vi.fn(() => true),
  has_opted_out_capturing: vi.fn(() => false),
  get_session_id: vi.fn(),
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
    posthogMock.opt_in_capturing.mockImplementation(() => undefined)
    posthogMock.has_opted_in_capturing.mockReturnValue(true)
    posthogMock.has_opted_out_capturing.mockReturnValue(false)
    posthogMock.config.token = ''
    posthogMock.init.mockImplementation((key: string, config: { loaded?: () => void }) => {
      posthogMock.config.token = key
      config.loaded?.()
    })
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
    expect(posthogMock.opt_out_capturing).toHaveBeenCalled()
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

  it('exposes only a bounded session identifier after analytics consent', async () => {
    const { getConsentedPostHogSessionId, enablePostHogAnalyticsCapture } = await import('@/posthog/client-api')
    posthogMock.get_session_id.mockReturnValueOnce('session_42')

    expect(getConsentedPostHogSessionId()).toBeUndefined()
    expect(enablePostHogAnalyticsCapture()).toBe(true)
    expect(getConsentedPostHogSessionId()).toBe('session_42')

    posthogMock.get_session_id.mockReturnValueOnce('invalid session id')
    expect(getConsentedPostHogSessionId()).toBeUndefined()
  })

  it('waits for SDK load and confirms the configured token before readiness', async () => {
    let loaded: (() => void) | undefined
    posthogMock.init.mockImplementation((key: string, config: { loaded?: () => void }) => {
      posthogMock.config.token = key
      loaded = config.loaded
    })
    const client = await import('@/posthog/client')
    expect(client.enablePostHog()).toBe(false)
    expect(client.getPostHogReadiness()).toBe(false)
    loaded?.()
    expect(client.getPostHogReadiness()).toBe(true)
    expect(posthogMock.init).toHaveBeenCalledTimes(1)
  })

  it.each(['missing_key', 'init_throws', 'wrong_token', 'opt_in_throws', 'unconfirmed_consent'])(
    'keeps capture closed for %s',
    async (failure) => {
      if (failure === 'missing_key') delete process.env.NEXT_PUBLIC_POSTHOG_KEY
      if (failure === 'init_throws')
        posthogMock.init.mockImplementation(() => {
          throw new Error('synthetic failure')
        })
      if (failure === 'wrong_token')
        posthogMock.init.mockImplementation(() => {
          posthogMock.config.token = ''
        })
      if (failure === 'opt_in_throws')
        posthogMock.opt_in_capturing.mockImplementationOnce(() => {
          throw new Error('synthetic failure')
        })
      if (failure === 'unconfirmed_consent') posthogMock.has_opted_in_capturing.mockReturnValue(false)
      const client = await import('@/posthog/client')
      expect(client.enablePostHog()).toBe(false)
      expect(client.getPostHogReadiness()).toBe(false)
      expect(client.getPostHogSessionId()).toBeUndefined()
    },
  )

  it('unsubscribes readiness listeners without retaining mounted consumers', async () => {
    const client = await import('@/posthog/client')
    const notify = vi.fn()
    const unsubscribe = client.subscribePostHogReadiness(notify)
    client.enablePostHog()
    expect(notify).toHaveBeenCalledTimes(1)
    unsubscribe()
    client.disablePostHog()
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('does not expose the raw PostHog browser instance', async () => {
    const clientModule = await import('@/posthog/client')

    expect(clientModule).not.toHaveProperty('posthog')
  })
})
