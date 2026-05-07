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

const posthogNodeMocks = vi.hoisted(() => ({
  PostHog: vi.fn(),
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
    posthogNodeMocks.PostHog.mockImplementation(function (this: Record<string, unknown>) {
      Object.assign(this, fakeClient)
    })
    process.env = {
      ...oldEnv,
      NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
      NEXT_PUBLIC_POSTHOG_KEY: 'phc_test',
      POSTHOG_PERSONAL_API_KEY: 'phx_test', // pragma: allowlist secret
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

  it('uses code defaults when local evaluation is not configured', async () => {
    delete process.env.POSTHOG_PERSONAL_API_KEY

    const { evaluatePostHogFlags, resolvePostHogActor } = await import('@/posthog/api')
    const actor = await resolvePostHogActor({ authData })
    const flags = await evaluatePostHogFlags(actor, ['temporary-landing-mode'])

    expect(flags.isEnabled('temporary-landing-mode')).toBe(false)
    expect(fakeClient.evaluateFlags).not.toHaveBeenCalled()
    expect(fakeClient.getAllFlagsAndPayloads).not.toHaveBeenCalled()
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

  it('keeps the regular PostHog server client free of local-evaluation polling', async () => {
    const { getPostHogServer } = await import('@/posthog/server')

    getPostHogServer()

    expect(posthogNodeMocks.PostHog).toHaveBeenCalledWith(
      'phc_test',
      expect.not.objectContaining({
        enableLocalEvaluation: true,
        personalApiKey: 'phx_test', // pragma: allowlist secret
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
        personalApiKey: 'phx_test', // pragma: allowlist secret
        strictLocalEvaluation: true,
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
