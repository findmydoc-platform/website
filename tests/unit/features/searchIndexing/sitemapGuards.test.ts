import { beforeEach, describe, expect, it, vi } from 'vitest'

const posthogMocks = vi.hoisted(() => ({
  createPostHogHoldingEvaluationContext: vi.fn((input: { url: URL }) => ({
    feature_flag_site_host: input.url.hostname.toLowerCase(),
  })),
  evaluatePostHogFlags: vi.fn(),
  resolvePostHogHoldingFlagActor: vi.fn(),
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
    posthogMocks.resolvePostHogHoldingFlagActor.mockReturnValue(actor)
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      getEvaluation: vi.fn(() => ({ status: 'evaluated', value: false })),
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
    const getEvaluation = vi.fn(() => ({ status: 'evaluated', value: true }))
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      getEvaluation,
    })
    const request = new Request('https://findmydoc.eu/posts-sitemap.xml')
    const { shouldBlockSitemapIndexingForRequest } = await import('@/features/searchIndexing/sitemapGuards')

    await expect(
      shouldBlockSitemapIndexingForRequest(request, {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).resolves.toBe(false)

    expect(posthogMocks.createPostHogHoldingEvaluationContext).toHaveBeenCalledWith({
      url: new URL('https://findmydoc.eu/posts-sitemap.xml'),
    })
    expect(posthogMocks.resolvePostHogHoldingFlagActor).toHaveBeenCalledWith({
      feature_flag_site_host: 'findmydoc.eu',
    })
    expect(posthogMocks.evaluatePostHogFlags).toHaveBeenCalledWith(actor, ['temporary-landing-mode'], {
      context: {
        feature_flag_site_host: 'findmydoc.eu',
      },
    })
  })

  it('does not block the production sitemap when PostHog returns the code default', async () => {
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      getEvaluation: vi.fn(() => ({ status: 'evaluated', value: false })),
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
