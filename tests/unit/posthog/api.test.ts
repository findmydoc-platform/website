import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthData } from '@/auth/types/authTypes'

const fakeEvaluations = vi.hoisted(() => ({
  getFlag: vi.fn(),
  getFlagPayload: vi.fn(),
  only: vi.fn(),
  onlyAccessed: vi.fn(),
}))

const fakeClient = vi.hoisted(() => ({
  capture: vi.fn(),
  evaluateFlags: vi.fn(),
  getAllFlagsAndPayloads: vi.fn(),
  identify: vi.fn(),
}))

const runtimeCache = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}))

const getCache = vi.hoisted(() => vi.fn(() => runtimeCache))

const posthogNodeMocks = vi.hoisted(() => ({
  PostHog: vi.fn(),
}))

vi.mock('@vercel/functions', () => ({
  getCache,
}))

vi.mock('posthog-node', async (importOriginal) => ({
  ...(await importOriginal<typeof import('posthog-node')>()),
  ...posthogNodeMocks,
}))

vi.mock('@/auth/utilities/jwtValidation', () => ({
  extractSupabaseUserData: vi.fn(),
}))

describe('PostHog API facade', () => {
  const oldEnv = process.env

  const authData: AuthData = {
    supabaseUserId: 'user-123',
    userEmail: 'clinic@example.com',
    userType: 'clinic',
    firstName: 'Ada',
    lastName: 'Lovelace',
  }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    fakeEvaluations.getFlag.mockReturnValue(undefined)
    fakeEvaluations.getFlagPayload.mockReturnValue(undefined)
    fakeEvaluations.only.mockReturnValue(fakeEvaluations)
    fakeEvaluations.onlyAccessed.mockReturnValue(fakeEvaluations)
    fakeClient.evaluateFlags.mockResolvedValue(fakeEvaluations)
    fakeClient.getAllFlagsAndPayloads.mockResolvedValue({ featureFlagPayloads: {}, featureFlags: {} })
    runtimeCache.get.mockResolvedValue(null)
    runtimeCache.set.mockResolvedValue(undefined)
    posthogNodeMocks.PostHog.mockImplementation(function (this: Record<string, unknown>) {
      Object.assign(this, fakeClient)
    })
    process.env = {
      ...oldEnv,
      NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
      NEXT_PUBLIC_POSTHOG_KEY: 'phc_test',
      POSTHOG_FEATURE_FLAGS_SECURE_API_KEY: 'feature-flags-secure-key-for-test', // pragma: allowlist secret
    }
  })

  afterEach(async () => {
    const { resetPostHogServerForTests } = await import('@/posthog/server')
    const { resetPostHogClientForTests } = await import('@/posthog/api')
    resetPostHogServerForTests()
    resetPostHogClientForTests()
    process.env = oldEnv
  })

  it('resolves authenticated actors with stable person and group properties', async () => {
    const { resolvePostHogActor } = await import('@/posthog/api')

    const actor = await resolvePostHogActor({ authData, clinicId: 42 })

    expect(actor).toEqual({
      distinctId: 'user-123',
      email: 'clinic@example.com',
      groupProperties: { clinic: { id: '42' } },
      groups: { clinic: '42' },
      isAuthenticated: true,
      personProperties: {
        email: 'clinic@example.com',
        first_name: 'Ada',
        is_authenticated: 'true',
        last_name: 'Lovelace',
        user_type: 'clinic',
      },
      userType: 'clinic',
    })
  })

  it('resolves site flag actors without client-controlled cookie identity', async () => {
    const { resolvePostHogSiteFlagActor } = await import('@/posthog/api')

    const actor = resolvePostHogSiteFlagActor({
      feature_flag_site_host: 'findmydoc.eu',
      feature_flag_site_path: '/posts/example',
    })

    expect(actor).toEqual({
      distinctId: 'site:findmydoc.eu:/posts/example',
      isAuthenticated: false,
      personProperties: {
        is_authenticated: 'false',
        user_type: 'anonymous',
      },
      userType: 'anonymous',
    })
  })

  it('normalizes site flag context paths before PostHog targeting', async () => {
    const { createPostHogFlagEvaluationContext } = await import('@/posthog/api')

    expect(createPostHogFlagEvaluationContext({ url: new URL('https://FindMyDoc.eu/admin/') })).toEqual({
      feature_flag_site_host: 'findmydoc.eu',
      feature_flag_site_path: '/admin',
    })
  })

  it('uses code defaults when local evaluation is not configured', async () => {
    delete process.env.POSTHOG_FEATURE_FLAGS_SECURE_API_KEY

    const { evaluatePostHogFlags, resolvePostHogActor } = await import('@/posthog/api')
    const actor = await resolvePostHogActor({ authData })
    const flags = await evaluatePostHogFlags(actor, ['temporary-landing-mode', 'preview-guard-enabled'])

    expect(flags.isEnabled('temporary-landing-mode')).toBe(false)
    expect(flags.isEnabled('preview-guard-enabled')).toBe(false)
    expect(fakeClient.evaluateFlags).not.toHaveBeenCalled()
    expect(fakeClient.getAllFlagsAndPayloads).not.toHaveBeenCalled()
  })

  it('registers preview guard with a safe default', async () => {
    const { POSTHOG_FLAG_REGISTRY } = await import('@/posthog/api')

    expect(POSTHOG_FLAG_REGISTRY['preview-guard-enabled']).toEqual({
      defaultValue: false,
      description: 'Controls preview deployment access guard behavior in server-side proxy code.',
    })
  })

  it('evaluates requested flags locally and exposes a stable snapshot', async () => {
    fakeClient.getAllFlagsAndPayloads.mockResolvedValue({
      featureFlagPayloads: { 'temporary-landing-mode': { message: 'enabled' } },
      featureFlags: { 'temporary-landing-mode': true },
    })

    const { evaluatePostHogFlags, resolvePostHogActor } = await import('@/posthog/api')
    const actor = await resolvePostHogActor({ authData })
    const flags = await evaluatePostHogFlags(actor, ['temporary-landing-mode'])

    expect(flags.isEnabled('temporary-landing-mode')).toBe(true)
    expect(flags.getPayload('temporary-landing-mode', { message: 'fallback' })).toEqual({ message: 'enabled' })
    expect(fakeClient.getAllFlagsAndPayloads).toHaveBeenCalledWith('user-123', {
      disableGeoip: true,
      flagKeys: ['temporary-landing-mode'],
      groupProperties: undefined,
      groups: undefined,
      onlyEvaluateLocally: true,
      personProperties: {
        email: 'clinic@example.com',
        first_name: 'Ada',
        is_authenticated: 'true',
        last_name: 'Lovelace',
        user_type: 'clinic',
      },
    })
    expect(fakeClient.evaluateFlags).not.toHaveBeenCalled()
    expect(fakeClient.capture).not.toHaveBeenCalled()
  })

  it('passes strict request context into local flag evaluation', async () => {
    const { evaluatePostHogFlags, resolvePostHogActor } = await import('@/posthog/api')
    const actor = await resolvePostHogActor({ authData })

    await evaluatePostHogFlags(actor, ['temporary-landing-mode', 'preview-guard-enabled'], {
      context: {
        feature_flag_site_host: 'preview.findmydoc.eu',
        feature_flag_site_path: '/posts/example',
      },
    })

    expect(fakeClient.getAllFlagsAndPayloads).toHaveBeenCalledWith('user-123', {
      disableGeoip: true,
      flagKeys: ['temporary-landing-mode', 'preview-guard-enabled'],
      groupProperties: undefined,
      groups: undefined,
      onlyEvaluateLocally: true,
      personProperties: {
        email: 'clinic@example.com',
        feature_flag_site_host: 'preview.findmydoc.eu',
        feature_flag_site_path: '/posts/example',
        first_name: 'Ada',
        is_authenticated: 'true',
        last_name: 'Lovelace',
        user_type: 'clinic',
      },
    })
  })

  it('separates in-flight flag evaluations by request context', async () => {
    const pendingResolutions: Array<
      (value: { featureFlagPayloads: Record<string, unknown>; featureFlags: Record<string, unknown> }) => void
    > = []
    fakeClient.getAllFlagsAndPayloads.mockImplementation(
      () =>
        new Promise((resolve) => {
          pendingResolutions.push(resolve)
        }),
    )

    const { evaluatePostHogFlags, resolvePostHogActor } = await import('@/posthog/api')
    const actor = await resolvePostHogActor({ authData })
    const firstEvaluation = evaluatePostHogFlags(actor, ['temporary-landing-mode'], {
      context: {
        feature_flag_site_host: 'findmydoc.eu',
        feature_flag_site_path: '/posts/example',
      },
    })
    const secondEvaluation = evaluatePostHogFlags(actor, ['temporary-landing-mode'], {
      context: {
        feature_flag_site_host: 'findmydoc.eu',
        feature_flag_site_path: '/posts/other',
      },
    })

    expect(fakeClient.getAllFlagsAndPayloads).toHaveBeenCalledTimes(2)
    pendingResolutions.forEach((resolve) => resolve({ featureFlagPayloads: {}, featureFlags: {} }))

    await Promise.all([firstEvaluation, secondEvaluation])
  })

  it('keeps the regular PostHog server client free of local-evaluation polling', async () => {
    const { getPostHogServer } = await import('@/posthog/server')

    getPostHogServer()

    expect(posthogNodeMocks.PostHog).toHaveBeenCalledWith(
      'phc_test',
      expect.not.objectContaining({
        enableLocalEvaluation: true,
        personalApiKey: 'feature-flags-secure-key-for-test', // pragma: allowlist secret
      }),
    )
  })

  it('configures the PostHog feature flag client for 120 second local-evaluation polling', async () => {
    const {
      getPostHogFeatureFlagServer,
      POSTHOG_FEATURE_FLAGS_IDLE_SHUTDOWN_MS,
      POSTHOG_FEATURE_FLAGS_POLLING_INTERVAL_MS,
    } = await import('@/posthog/server')

    getPostHogFeatureFlagServer()

    expect(POSTHOG_FEATURE_FLAGS_POLLING_INTERVAL_MS).toBe(120_000)
    expect(POSTHOG_FEATURE_FLAGS_IDLE_SHUTDOWN_MS).toBe(150_000)
    expect(posthogNodeMocks.PostHog).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        enableLocalEvaluation: true,
        featureFlagsPollingInterval: 120_000,
        personalApiKey: 'feature-flags-secure-key-for-test', // pragma: allowlist secret
        strictLocalEvaluation: true,
      }),
    )
  })

  it('attaches the Vercel runtime cache provider to the feature flag client on Vercel', async () => {
    process.env.VERCEL = '1'

    const { getPostHogFeatureFlagServer } = await import('@/posthog/server')

    getPostHogFeatureFlagServer()

    expect(getCache).toHaveBeenCalledWith({ namespace: 'posthog-feature-flags' })
    expect(posthogNodeMocks.PostHog).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        flagDefinitionCacheProvider: expect.objectContaining({
          getFlagDefinitions: expect.any(Function),
          onFlagDefinitionsReceived: expect.any(Function),
          shouldFetchFlagDefinitions: expect.any(Function),
        }),
      }),
    )
  })

  it('captures events with the already evaluated flag snapshot', async () => {
    fakeClient.getAllFlagsAndPayloads.mockResolvedValue({
      featureFlagPayloads: {},
      featureFlags: { 'temporary-landing-mode': true },
    })

    const { capturePostHogEvent, evaluatePostHogFlags, resolvePostHogActor } = await import('@/posthog/api')
    const actor = await resolvePostHogActor({ authData })
    const flags = await evaluatePostHogFlags(actor, ['temporary-landing-mode'])

    capturePostHogEvent({
      actor,
      event: 'clinic profile viewed',
      flagKeys: ['temporary-landing-mode'],
      flags,
      properties: { clinicId: '42' },
    })

    const capturedFlags = fakeClient.capture.mock.calls[0]?.[0]?.flags
    expect(capturedFlags?._getEventProperties()).toEqual({
      $active_feature_flags: ['temporary-landing-mode'],
      '$feature/temporary-landing-mode': true,
    })
    expect(fakeClient.capture).toHaveBeenCalledWith({
      distinctId: 'user-123',
      event: 'clinic profile viewed',
      flags: capturedFlags,
      groups: undefined,
      properties: { clinicId: '42' },
    })
  })
})
