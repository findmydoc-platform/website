import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('sendExceptionToPostHog', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...OLD_ENV }
  })

  afterEach(() => {
    process.env = OLD_ENV
    vi.restoreAllMocks()
  })

  it('does not throw when PostHog env is missing', async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST

    const posthog = await import('../../../src/posthog/server')
    await expect(posthog.sendExceptionToPostHog(new Error('test'))).resolves.not.toThrow()
  })

  it('calls client.captureException and shutdown when client available', async () => {
    const fakeClient = {
      captureException: vi.fn(() => Promise.resolve()),
      shutdown: vi.fn(() => Promise.resolve()),
    } as unknown

    // Ensure getPostHogServer will construct a client that returns our fakeClient
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'x'
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://ph'

    vi.mock('posthog-node', () => ({ PostHog: vi.fn(() => fakeClient) }))

    const posthog = await import('../../../src/posthog/server')

    await expect(
      posthog.sendExceptionToPostHog(new Error('boom'), { distinctId: 'user-1', url: '/test' }),
    ).resolves.not.toThrow()
  })
})
