import { beforeEach, describe, expect, it, vi } from 'vitest'

const posthogMocks = vi.hoisted(() => ({
  createPostHogFlagEvaluationContext: vi.fn((input: { url: URL }) => {
    const pathname = input.url.pathname || '/'
    const normalizedPath = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

    return {
      feature_flag_site_host: input.url.hostname,
      feature_flag_site_path: normalizedPath,
    }
  }),
  evaluatePostHogFlags: vi.fn(),
  resolvePostHogSiteFlagActor: vi.fn(),
}))

vi.mock('@/posthog/api', () => posthogMocks)

describe('public discovery access', () => {
  const actor = {
    distinctId: 'site:findmydoc.eu:/llms.txt',
    isAuthenticated: false,
    personProperties: {},
    userType: 'anonymous',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    posthogMocks.resolvePostHogSiteFlagActor.mockReturnValue(actor)
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      isEnabled: vi.fn(() => false),
    })
  })

  it('blocks preview runtimes before evaluating feature flags', async () => {
    const { resolvePublicDiscoveryAccessForRequest } = await import('@/features/publicDiscovery/access')

    await expect(
      resolvePublicDiscoveryAccessForRequest(new Request('https://findmydoc.eu/llms.txt'), {
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
      }),
    ).resolves.toEqual({
      allowed: false,
      reason: 'preview-runtime',
    })

    expect(posthogMocks.evaluatePostHogFlags).not.toHaveBeenCalled()
  })

  it('uses request URLs only as PostHog context outside preview runtime', async () => {
    const { resolvePublicDiscoveryAccessForRequest } = await import('@/features/publicDiscovery/access')

    await expect(
      resolvePublicDiscoveryAccessForRequest(new Request('https://preview.findmydoc.eu/llms.txt'), {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).resolves.toEqual({
      allowed: true,
    })

    expect(posthogMocks.createPostHogFlagEvaluationContext).toHaveBeenCalledWith({
      url: new URL('https://preview.findmydoc.eu/llms.txt'),
    })
    expect(posthogMocks.evaluatePostHogFlags).toHaveBeenCalledOnce()
  })

  it('blocks production discovery when temporary landing mode is active', async () => {
    const isEnabled = vi.fn((key: string) => key === 'temporary-landing-mode')
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      isEnabled,
    })
    const { resolvePublicDiscoveryAccessForRequest } = await import('@/features/publicDiscovery/access')
    const request = new Request('https://findmydoc.eu/llms.txt')

    await expect(
      resolvePublicDiscoveryAccessForRequest(request, {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).resolves.toEqual({
      allowed: false,
      reason: 'temporary-landing-mode',
    })

    expect(posthogMocks.createPostHogFlagEvaluationContext).toHaveBeenCalledWith({
      url: new URL('https://findmydoc.eu/llms.txt'),
    })
    expect(posthogMocks.resolvePostHogSiteFlagActor).toHaveBeenCalledWith({
      feature_flag_site_host: 'findmydoc.eu',
      feature_flag_site_path: '/llms.txt',
    })
    expect(posthogMocks.evaluatePostHogFlags).toHaveBeenCalledWith(actor, ['temporary-landing-mode'], {
      context: {
        feature_flag_site_host: 'findmydoc.eu',
        feature_flag_site_path: '/llms.txt',
      },
    })
  })

  it('allows production discovery when runtime and feature flag policy allow it', async () => {
    const { resolvePublicDiscoveryAccessForRequest } = await import('@/features/publicDiscovery/access')

    await expect(
      resolvePublicDiscoveryAccessForRequest(new Request('https://findmydoc.eu/.well-known/llms.txt'), {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).resolves.toEqual({
      allowed: true,
    })
  })

  it('builds a blocked no-discovery response', async () => {
    const { buildPublicDiscoveryBlockedResponse } = await import('@/features/publicDiscovery/access')
    const response = buildPublicDiscoveryBlockedResponse({
      headers: {
        'Content-Type': 'text/plain',
        'X-Robots-Tag': 'index',
      },
    })

    expect(response.status).toBe(404)
    expect(response.headers.get('Content-Type')).toBe('text/plain')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive')
    expect(await response.text()).toBe('')
  })
})
