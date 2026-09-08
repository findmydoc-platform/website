import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted fake client so the mocked factory (which is hoisted) can reference
// the per-test instance safely. See other tests using `vi.hoisted` in this repo.
const fakeClient = vi.hoisted(() => ({
  captureException: vi.fn(() => Promise.resolve()),
  flush: vi.fn(() => Promise.resolve()),
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
    vi.useRealTimers()
    process.env = OLD_ENV
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('does not throw when PostHog env is missing', async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST
    process.env = {
      ...process.env,
      DEPLOYMENT_COMMIT_SHA: 'a'.repeat(40),
      DEPLOYMENT_ENVIRONMENT: 'production',
      NODE_ENV: 'production',
      RELEASE_VERSION: 'v1.2.3',
    }

    const posthog = await import('../../../src/posthog/server')
    await expect(posthog.sendExceptionToPostHog(new Error('test'))).resolves.not.toThrow()

    // Ensure the client was not called when PostHog is not configured
    expect(fakeClient.captureException).not.toHaveBeenCalled()
    expect(fakeClient.flush).not.toHaveBeenCalled()
  })

  it('calls client.captureException with trusted deployment metadata when client available', async () => {
    // Ensure getPostHogServer will construct a client that returns our fakeClient
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'x'
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://ph'
    process.env = {
      ...process.env,
      DEPLOYMENT_COMMIT_SHA: 'a'.repeat(40),
      DEPLOYMENT_ENVIRONMENT: 'production',
      NODE_ENV: 'production',
      RELEASE_VERSION: 'v1.2.3',
    }

    const posthog = await import('../../../src/posthog/server')

    const error = new Error('boom')

    await expect(
      posthog.sendExceptionToPostHog(error, {
        distinctId: 'user-1',
        properties: {
          application: 'caller-value',
          authorization: 'sensitive', // pragma: allowlist secret
          cookie: 'sensitive', // pragma: allowlist secret
          credential: 'sensitive', // pragma: allowlist secret
          deployment_commit_sha: 'b'.repeat(40),
          deployment_environment: 'preview',
          detail: 'Bearer secret-token', // pragma: allowlist secret
          error: 'caller-value',
          headers: 'sensitive',
          password: 'sensitive', // pragma: allowlist secret
          query: 'sensitive',
          release_version: 'v9.9.9',
          request_url: '/private?token=sensitive', // pragma: allowlist secret
          secret: 'sensitive', // pragma: allowlist secret
          token: 'sensitive', // pragma: allowlist secret
        },
        url: '/test?access_token=sensitive',
      }),
    ).resolves.not.toThrow()

    expect(posthogNodeMocks.PostHog).toHaveBeenCalled()

    expect(fakeClient.captureException).toHaveBeenCalledWith(error, 'server:website', {
      application: 'website',
      deployment_commit_sha: 'a'.repeat(40),
      deployment_environment: 'production',
      error: 'boom',
      release_version: 'v1.2.3',
      request_url: '/private',
      url: '/test',
    })
    expect(fakeClient.flush).toHaveBeenCalled()
  })

  it('does not construct a PostHog client when deployment metadata is invalid', async () => {
    process.env = {
      ...process.env,
      DEPLOYMENT_COMMIT_SHA: 'short-sha',
      DEPLOYMENT_ENVIRONMENT: 'production',
      NEXT_PUBLIC_POSTHOG_HOST: 'https://ph',
      NEXT_PUBLIC_POSTHOG_KEY: 'x',
      NODE_ENV: 'production',
      RELEASE_VERSION: 'v1.2.3',
    }

    const posthog = await import('../../../src/posthog/server')
    await expect(posthog.sendExceptionToPostHog(new Error('boom'))).resolves.not.toThrow()

    expect(posthogNodeMocks.PostHog).not.toHaveBeenCalled()
    expect(fakeClient.captureException).not.toHaveBeenCalled()
    expect(fakeClient.flush).not.toHaveBeenCalled()
  })

  it('returns within a fixed budget when PostHog capture does not settle', async () => {
    vi.useFakeTimers()
    fakeClient.captureException.mockReturnValue(new Promise(() => undefined))
    process.env = {
      ...process.env,
      DEPLOYMENT_COMMIT_SHA: 'a'.repeat(40),
      DEPLOYMENT_ENVIRONMENT: 'production',
      NEXT_PUBLIC_POSTHOG_HOST: 'https://ph',
      NEXT_PUBLIC_POSTHOG_KEY: 'x',
      NODE_ENV: 'production',
      RELEASE_VERSION: 'v1.2.3',
    }

    const posthog = await import('../../../src/posthog/server')
    const result = posthog.sendExceptionToPostHog(new Error('boom'))

    await vi.advanceTimersByTimeAsync(1_500)

    await expect(result).resolves.toBeUndefined()
    expect(fakeClient.captureException).toHaveBeenCalledOnce()
    expect(fakeClient.flush).not.toHaveBeenCalled()
  })

  it('writes a structured local log without constructing a PostHog client', async () => {
    delete process.env.DEPLOYMENT_COMMIT_SHA
    delete process.env.DEPLOYMENT_ENVIRONMENT
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST
    delete process.env.RELEASE_VERSION
    process.env = { ...process.env, NODE_ENV: 'test' }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const posthog = await import('../../../src/posthog/server')
    await posthog.sendExceptionToPostHog(new Error('boom'), {
      method: 'GET',
      url: '/auth/callback',
    })

    expect(posthogNodeMocks.PostHog).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      expect.objectContaining({
        application: 'website',
        distinctId: 'server:website',
        err: expect.any(Error),
        event: 'telemetry.posthog.exception_local',
        method: 'GET',
        posthog_event: '$exception',
        url: '/auth/callback',
      }),
      expect.any(String),
    )
    expect(consoleError).toHaveBeenCalledWith(
      expect.not.objectContaining({ error: expect.anything() }),
      expect.any(String),
    )
  })
})
