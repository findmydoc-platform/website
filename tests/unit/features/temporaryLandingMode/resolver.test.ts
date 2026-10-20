import { beforeEach, describe, expect, it, vi } from 'vitest'

const posthogMocks = vi.hoisted(() => ({
  createPostHogHoldingEvaluationContext: vi.fn((input: { url: URL }) => ({
    feature_flag_site_host: input.url.hostname.toLowerCase(),
  })),
  evaluatePostHogFlags: vi.fn(),
  resolvePostHogHoldingFlagActor: vi.fn(() => ({
    distinctId: 'holding:findmydoc.eu',
    isAuthenticated: false,
    personProperties: { is_authenticated: 'false', user_type: 'anonymous' },
    userType: 'anonymous',
  })),
}))

vi.mock('@/posthog/api', () => posthogMocks)

describe('Holding mode resolver', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      getEvaluation: vi.fn(() => ({ status: 'evaluated', value: true })),
    })
  })

  it('uses host-only PostHog evaluation and selects Holding for true', async () => {
    const { resolveHoldingMode } = await import('@/features/temporaryLandingMode/resolver')
    const url = new URL('https://FindMyDoc.eu/posts/article')

    await expect(resolveHoldingMode(url, { PUBLIC_SITE_FALLBACK_MODE: 'full' })).resolves.toEqual({
      mode: 'holding',
      source: 'posthog',
    })
    expect(posthogMocks.createPostHogHoldingEvaluationContext).toHaveBeenCalledWith({ url })
    expect(posthogMocks.evaluatePostHogFlags).toHaveBeenCalledWith(
      expect.objectContaining({ distinctId: 'holding:findmydoc.eu' }),
      ['temporary-landing-mode'],
      { context: { feature_flag_site_host: 'findmydoc.eu' } },
    )
  })

  it('uses full fallback for an evaluated false value', async () => {
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      getEvaluation: vi.fn(() => ({ status: 'evaluated', value: false })),
    })
    const { resolveHoldingMode } = await import('@/features/temporaryLandingMode/resolver')

    await expect(resolveHoldingMode(new URL('https://findmydoc.eu/'), {})).resolves.toEqual({
      mode: 'full',
      source: 'posthog',
    })
  })

  it.each([
    ['missing', { status: 'unavailable', reason: 'missing' }],
    ['invalid', { status: 'unavailable', reason: 'invalid' }],
    ['error', { status: 'unavailable', reason: 'error' }],
    ['string', { status: 'evaluated', value: 'variant' }],
  ] as const)('uses deployment fallback when PostHog result is %s', async (_label, evaluation) => {
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({ getEvaluation: vi.fn(() => evaluation) })
    const { resolveHoldingMode } = await import('@/features/temporaryLandingMode/resolver')

    await expect(
      resolveHoldingMode(new URL('https://findmydoc.eu/'), { PUBLIC_SITE_FALLBACK_MODE: 'full' }),
    ).resolves.toEqual({
      mode: 'full',
      source: 'deployment-fallback',
      reason: evaluation.status === 'unavailable' ? evaluation.reason : 'invalid-output',
    })
  })

  it('defaults missing or invalid deployment configuration to Holding', async () => {
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      getEvaluation: vi.fn(() => ({ status: 'unavailable', reason: 'not-configured' })),
    })
    const { resolveHoldingMode } = await import('@/features/temporaryLandingMode/resolver')

    await expect(resolveHoldingMode(new URL('https://findmydoc.eu/'), {})).resolves.toEqual({
      mode: 'holding',
      source: 'deployment-fallback',
      reason: 'missing-fallback-configuration',
    })
    await expect(
      resolveHoldingMode(new URL('https://findmydoc.eu/'), { PUBLIC_SITE_FALLBACK_MODE: 'open' }),
    ).resolves.toEqual({
      mode: 'holding',
      source: 'deployment-fallback',
      reason: 'invalid-fallback-configuration',
    })
  })
})
