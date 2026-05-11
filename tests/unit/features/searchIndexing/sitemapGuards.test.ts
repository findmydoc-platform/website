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

describe('sitemap indexing guards', () => {
  const actor = {
    distinctId: 'site:production:findmydoc.eu',
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

  it('blocks sitemaps in preview without evaluating PostHog', async () => {
    const { shouldBlockSitemapIndexingForRequest } = await import('@/features/searchIndexing/sitemapGuards')

    await expect(
      shouldBlockSitemapIndexingForRequest(new Request('https://preview.findmydoc.eu/pages-sitemap.xml'), {
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
      }),
    ).resolves.toBe(true)

    expect(posthogMocks.evaluatePostHogFlags).not.toHaveBeenCalled()
  })

  it('uses the temporary landing flag for production sitemap decisions', async () => {
    const isEnabled = vi.fn((key: string) => key === 'temporary-landing-mode')
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      isEnabled,
    })
    const request = new Request('https://findmydoc.eu/posts-sitemap.xml')
    const { shouldBlockSitemapIndexingForRequest } = await import('@/features/searchIndexing/sitemapGuards')

    await expect(
      shouldBlockSitemapIndexingForRequest(request, {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).resolves.toBe(true)

    expect(posthogMocks.createPostHogFlagEvaluationContext).toHaveBeenCalledWith({
      url: new URL('https://findmydoc.eu/posts-sitemap.xml'),
    })
    expect(posthogMocks.resolvePostHogSiteFlagActor).toHaveBeenCalledWith({
      feature_flag_site_host: 'findmydoc.eu',
      feature_flag_site_path: '/posts-sitemap.xml',
    })
    expect(posthogMocks.evaluatePostHogFlags).toHaveBeenCalledWith(actor, ['temporary-landing-mode'], {
      context: {
        feature_flag_site_host: 'findmydoc.eu',
        feature_flag_site_path: '/posts-sitemap.xml',
      },
    })
  })

  it('does not block the production sitemap when PostHog returns the code default', async () => {
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      isEnabled: vi.fn(() => false),
    })
    const request = new Request('https://findmydoc.eu/pages-sitemap.xml')
    const { shouldBlockSitemapIndexingForRequest } = await import('@/features/searchIndexing/sitemapGuards')

    await expect(
      shouldBlockSitemapIndexingForRequest(request, {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).resolves.toBe(false)
  })
})
