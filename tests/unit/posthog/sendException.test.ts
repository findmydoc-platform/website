import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted fake client so the mocked factory (which is hoisted) can reference
// the per-test instance safely. See other tests using `vi.hoisted` in this repo.
const fakeClient = vi.hoisted(() => ({
  captureException: vi.fn(() => Promise.resolve()),
  shutdown: vi.fn(() => Promise.resolve()),
}))

const posthogNodeMocks = vi.hoisted(() => ({
  PostHog: vi.fn(),
}))

vi.mock('posthog-node', () => posthogNodeMocks)

describe('sendExceptionToPostHog', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    posthogNodeMocks.PostHog.mockImplementation(function (this: Record<string, unknown>) {
      Object.assign(this, fakeClient)
    })
    process.env = { ...OLD_ENV }
  })

  afterEach(() => {
    process.env = OLD_ENV
    vi.clearAllMocks()
  })

  it('does not throw when PostHog env is missing', async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST

    const posthog = await import('../../../src/posthog/server')
    await expect(posthog.sendExceptionToPostHog(new Error('test'))).resolves.not.toThrow()

    // Ensure the client was not called when PostHog is not configured
    expect(fakeClient.captureException).not.toHaveBeenCalled()
    expect(fakeClient.shutdown).not.toHaveBeenCalled()
  })

  it('calls client.captureException and shutdown when client available', async () => {
    // Ensure getPostHogServer will construct a client that returns our fakeClient
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'x'
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://ph'

    const posthog = await import('../../../src/posthog/server')

    await expect(
      posthog.sendExceptionToPostHog(new Error('boom'), { distinctId: 'user-1', url: '/test' }),
    ).resolves.not.toThrow()

    expect(posthogNodeMocks.PostHog).toHaveBeenCalled()

    expect(fakeClient.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ distinctId: 'user-1', url: '/test' }),
    )
    expect(fakeClient.shutdown).toHaveBeenCalled()
  })
})
