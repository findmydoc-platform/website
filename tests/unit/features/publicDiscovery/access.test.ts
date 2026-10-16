import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolverMocks = vi.hoisted(() => ({
  resolveHoldingMode: vi.fn(),
}))

vi.mock('@/features/temporaryLandingMode/resolver', () => resolverMocks)

describe('public discovery access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolverMocks.resolveHoldingMode.mockResolvedValue({ mode: 'full', source: 'posthog' })
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

    expect(resolverMocks.resolveHoldingMode).not.toHaveBeenCalled()
  })

  it('uses the shared host resolver outside preview runtime', async () => {
    const { resolvePublicDiscoveryAccessForRequest } = await import('@/features/publicDiscovery/access')

    await expect(
      resolvePublicDiscoveryAccessForRequest(new Request('https://preview.findmydoc.eu/llms.txt'), {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).resolves.toEqual({
      allowed: true,
    })

    expect(resolverMocks.resolveHoldingMode).toHaveBeenCalledWith(new URL('https://preview.findmydoc.eu/llms.txt'), {
      PUBLIC_SITE_FALLBACK_MODE: undefined,
    })
  })

  it('blocks production discovery when temporary landing mode is active', async () => {
    resolverMocks.resolveHoldingMode.mockResolvedValue({ mode: 'holding', source: 'posthog' })
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

    expect(resolverMocks.resolveHoldingMode).toHaveBeenCalledOnce()
  })

  it('allows only the blog discovery files when temporary landing mode is active', async () => {
    resolverMocks.resolveHoldingMode.mockResolvedValue({ mode: 'holding', source: 'posthog' })
    const { resolvePublicDiscoveryAccessForRequest } = await import('@/features/publicDiscovery/access')

    await expect(
      resolvePublicDiscoveryAccessForRequest(new Request('https://findmydoc.eu/posts-sitemap.xml'), {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).resolves.toEqual({
      allowed: true,
      temporaryLandingMode: true,
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

  it('uses an explicit sanitized public mode marker without resolving PostHog again', async () => {
    const { resolvePublicDiscoveryAccessForRequest } = await import('@/features/publicDiscovery/access')
    const request = new Request('https://findmydoc.eu/llms.txt', {
      headers: { 'x-public-site-mode': 'holding' },
    })

    await expect(
      resolvePublicDiscoveryAccessForRequest(request, {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).resolves.toEqual({ allowed: false, reason: 'temporary-landing-mode' })
    expect(resolverMocks.resolveHoldingMode).not.toHaveBeenCalled()
  })

  it('ignores unknown mode markers and resolves mode directly', async () => {
    const { resolvePublicDiscoveryAccessForRequest } = await import('@/features/publicDiscovery/access')
    const request = new Request('https://findmydoc.eu/llms.txt', {
      headers: { 'x-public-site-mode': 'admin' },
    })

    await expect(
      resolvePublicDiscoveryAccessForRequest(request, {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).resolves.toEqual({ allowed: true })
    expect(resolverMocks.resolveHoldingMode).toHaveBeenCalledOnce()
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
