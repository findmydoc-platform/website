// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const posthogMock = vi.hoisted(() => ({
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

  it('enables and disables capturing explicitly', async () => {
    const { enablePostHog, disablePostHog } = await import('@/posthog/client')

    enablePostHog()
    disablePostHog()

    expect(posthogMock.init).toHaveBeenCalledTimes(1)
    expect(posthogMock.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false })
    expect(posthogMock.opt_out_capturing).toHaveBeenCalledTimes(1)
    expect(posthogMock.reset).toHaveBeenCalledTimes(1)
  })
})
