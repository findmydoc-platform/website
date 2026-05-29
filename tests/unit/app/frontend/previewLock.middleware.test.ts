import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { PREVIEW_GUARD_LOCK_REQUEST_HEADER } from '@/features/previewGuard'
import { SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE } from '@/features/searchIndexing'
import { TEMPORARY_LANDING_MODE_REQUEST_HEADER } from '@/features/temporaryLandingMode'

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createPostHogFlagEvaluationContext: vi.fn((input: { url: URL }) => {
    const pathname = input.url.pathname || '/'
    const normalizedPath = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

    return {
      feature_flag_site_host: input.url.hostname.trim().toLowerCase(),
      feature_flag_site_path: normalizedPath,
    }
  }),
  evaluatePostHogFlags: vi.fn(),
  getUser: vi.fn(),
  resolvePostHogSiteFlagActor: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}))

vi.mock('@/posthog/api', () => ({
  createPostHogFlagEvaluationContext: mocks.createPostHogFlagEvaluationContext,
  evaluatePostHogFlags: mocks.evaluatePostHogFlags,
  resolvePostHogSiteFlagActor: mocks.resolvePostHogSiteFlagActor,
}))

import { config, proxy } from '@/proxy'

type GuardFlagKey = 'preview-guard-enabled' | 'temporary-landing-mode'

const siteActor = {
  distinctId: 'site:preview.findmydoc.eu:/posts/example',
  isAuthenticated: false,
  personProperties: {
    is_authenticated: 'false',
    user_type: 'anonymous',
  },
  userType: 'anonymous',
}

const mockGuardFlags = (enabled: Partial<Record<GuardFlagKey, boolean>> = {}) => {
  mocks.evaluatePostHogFlags.mockResolvedValue({
    getPayload: vi.fn((_key: GuardFlagKey, fallback: unknown) => fallback),
    getVariant: vi.fn((_key: GuardFlagKey, fallback: string) => fallback),
    isEnabled: vi.fn((key: GuardFlagKey) => enabled[key] ?? false),
    keys: ['temporary-landing-mode', 'preview-guard-enabled'],
  })
}

describe('preview lock proxy', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENV: undefined,
      VERCEL_ENV: undefined,
      NODE_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
    }

    vi.clearAllMocks()
    mockGuardFlags()
    mocks.resolvePostHogSiteFlagActor.mockReturnValue(siteActor)

    mocks.createServerClient.mockReturnValue({
      auth: {
        getUser: mocks.getUser,
      },
    })
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('allows unauthenticated preview users when PostHog guard flags are disabled', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    const request = new NextRequest('https://preview.findmydoc.eu/posts/example?foo=bar')

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBeNull()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('passes host and path context into PostHog flag evaluation', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    const request = new NextRequest('https://preview.findmydoc.eu/posts/example/?foo=bar')

    await proxy(request)

    expect(mocks.resolvePostHogSiteFlagActor).toHaveBeenCalledWith({
      feature_flag_site_host: 'preview.findmydoc.eu',
      feature_flag_site_path: '/posts/example',
    })
    expect(mocks.evaluatePostHogFlags).toHaveBeenCalledWith(
      siteActor,
      ['temporary-landing-mode', 'preview-guard-enabled'],
      {
        context: {
          feature_flag_site_host: 'preview.findmydoc.eu',
          feature_flag_site_path: '/posts/example',
        },
      },
    )
  })

  it('does not set preview lock headers on exempt routes while guard flags are disabled', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    const request = new NextRequest('https://preview.findmydoc.eu/admin/login')

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBeNull()
  })

  it('does not consult Supabase while guard flags are disabled', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', app_metadata: { user_type: 'clinic' } } },
      error: null,
    })

    const request = new NextRequest('https://preview.findmydoc.eu/posts/example')
    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(mocks.getUser).not.toHaveBeenCalled()
  })

  it('leaves guards inactive when PostHog evaluation falls back to code defaults', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mocks.evaluatePostHogFlags.mockResolvedValue({
      getPayload: vi.fn((_key: GuardFlagKey, fallback: unknown) => fallback),
      getVariant: vi.fn((_key: GuardFlagKey, fallback: string) => fallback),
      isEnabled: vi.fn(() => false),
      keys: ['temporary-landing-mode', 'preview-guard-enabled'],
    })

    const request = new NextRequest('https://preview.findmydoc.eu/posts/example')
    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBeNull()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('uses the preview guard flag regardless of production runtime', async () => {
    process.env.VERCEL_ENV = 'production'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const request = new NextRequest('https://findmydoc.eu/posts/example')
    const response = await proxy(request)
    const location = response.headers.get('location')

    expect(response.status).toBe(307)
    expect(location).toContain('/admin/login')
    expect(location).toContain('message=preview-login-required')
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('redirects unauthenticated users when preview guard flag is enabled in preview runtime', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const request = new NextRequest('https://preview.findmydoc.eu/posts/example?foo=bar')
    const response = await proxy(request)
    const location = response.headers.get('location')

    expect(response.status).toBe(307)
    expect(location).toContain('/admin/login')
    expect(location).toContain('message=preview-login-required')
    expect(location).toContain('next=%2Fposts%2Fexample%3Ffoo%3Dbar')
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('keeps preview guard exempt paths reachable with lock headers', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })
    const request = new NextRequest('https://preview.findmydoc.eu/admin/login')

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('routes first-admin bootstrap paths through the preview guard chain', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const firstAdminResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/admin/first-admin'))
    const createFirstUserResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/admin/create-first-user'))

    expect(firstAdminResponse.status).toBe(307)
    expect(firstAdminResponse.headers.get('location')).toContain('/admin/login')
    expect(firstAdminResponse.headers.get('location')).toContain('next=%2Fadmin%2Ffirst-admin')
    expect(firstAdminResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)

    expect(createFirstUserResponse.status).toBe(307)
    expect(createFirstUserResponse.headers.get('location')).toContain('/admin/login')
    expect(createFirstUserResponse.headers.get('location')).toContain('next=%2Fadmin%2Fcreate-first-user')
    expect(createFirstUserResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('marks root requests for temporary landing mode', async () => {
    mockGuardFlags({ 'temporary-landing-mode': true })
    const request = new NextRequest('https://findmydoc.eu/')

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBe('1')
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('returns 404 for non-root routes in temporary landing mode', async () => {
    mockGuardFlags({ 'temporary-landing-mode': true })
    const request = new NextRequest('https://findmydoc.eu/posts/example')

    const response = await proxy(request)

    expect(response.status).toBe(404)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('applies temporary landing mode to canonical crawl entrypoints', async () => {
    mockGuardFlags({ 'temporary-landing-mode': true })

    const robotsResponse = await proxy(new NextRequest('https://findmydoc.eu/robots.txt'))
    const sitemapResponse = await proxy(new NextRequest('https://findmydoc.eu/sitemap.xml'))

    expect(robotsResponse.status).toBe(404)
    expect(sitemapResponse.status).toBe(404)
    expect(robotsResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    expect(sitemapResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    expect(mocks.evaluatePostHogFlags).toHaveBeenCalledTimes(2)
  })

  it('keeps admin and auth routes reachable in temporary landing mode', async () => {
    mockGuardFlags({ 'temporary-landing-mode': true })

    const requests = [
      new NextRequest('https://findmydoc.eu/admin/login'),
      new NextRequest('https://findmydoc.eu/admin'),
      new NextRequest('https://findmydoc.eu/admin/account'),
      new NextRequest('https://findmydoc.eu/admin/first-admin'),
      new NextRequest('https://findmydoc.eu/admin/create-first-user'),
      new NextRequest('https://findmydoc.eu/auth/callback'),
      new NextRequest('https://findmydoc.eu/auth/password/reset'),
      new NextRequest('https://findmydoc.eu/auth/password/reset/complete'),
      new NextRequest('https://findmydoc.eu/auth/invite/complete'),
      new NextRequest('https://findmydoc.eu/login/patient'),
      new NextRequest('https://findmydoc.eu/register/patient'),
      new NextRequest('https://findmydoc.eu/register/clinic'),
    ]

    for (const request of requests) {
      const response = await proxy(request)
      expect(response.status).toBe(200)
      expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
      expect(response.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBe('1')
      expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    }
  })

  it('keeps privacy, imprint, and contact pages reachable in temporary landing mode', async () => {
    mockGuardFlags({ 'temporary-landing-mode': true })

    const privacyRequest = new NextRequest('https://findmydoc.eu/privacy-policy')
    const imprintRequest = new NextRequest('https://findmydoc.eu/imprint')
    const contactRequest = new NextRequest('https://findmydoc.eu/contact')

    const privacyResponse = await proxy(privacyRequest)
    const imprintResponse = await proxy(imprintRequest)
    const contactResponse = await proxy(contactRequest)

    expect(privacyResponse.status).toBe(200)
    expect(imprintResponse.status).toBe(200)
    expect(contactResponse.status).toBe(200)

    expect(privacyResponse.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
    expect(imprintResponse.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
    expect(contactResponse.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')

    expect(privacyResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    expect(imprintResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    expect(contactResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('keeps public temporary landing exempt pages reachable when preview guard is also active', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true, 'temporary-landing-mode': true })

    const privacyRequest = new NextRequest('https://preview.findmydoc.eu/privacy-policy')
    const imprintRequest = new NextRequest('https://preview.findmydoc.eu/imprint')
    const contactRequest = new NextRequest('https://preview.findmydoc.eu/contact')

    const privacyResponse = await proxy(privacyRequest)
    const imprintResponse = await proxy(imprintRequest)
    const contactResponse = await proxy(contactRequest)

    expect(privacyResponse.status).toBe(200)
    expect(imprintResponse.status).toBe(200)
    expect(contactResponse.status).toBe(200)

    expect(privacyResponse.headers.get('location')).toBeNull()
    expect(imprintResponse.headers.get('location')).toBeNull()
    expect(contactResponse.headers.get('location')).toBeNull()

    expect(privacyResponse.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBe('1')
    expect(imprintResponse.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBe('1')
    expect(contactResponse.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBe('1')

    expect(privacyResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    expect(imprintResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    expect(contactResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('allows platform users to bypass temporary landing mode', async () => {
    mockGuardFlags({ 'temporary-landing-mode': true })
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-2', app_metadata: { user_type: 'platform' } } },
      error: null,
    })

    const request = new NextRequest('https://findmydoc.eu/posts/example')
    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('prioritizes temporary landing mode over preview guard redirects for public pages', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true, 'temporary-landing-mode': true })

    const request = new NextRequest('https://preview.findmydoc.eu/posts/example')
    const response = await proxy(request)

    expect(response.status).toBe(404)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('keeps preview guard restrictions on temporary landing exempt admin routes', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true, 'temporary-landing-mode': true })

    const request = new NextRequest('https://preview.findmydoc.eu/admin')
    const response = await proxy(request)
    const location = response.headers.get('location')

    expect(response.status).toBe(307)
    expect(location).toContain('/admin/login')
    expect(location).toContain('message=preview-login-required')
    expect(response.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('bypasses API routes before evaluating PostHog flags', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    const request = new NextRequest('https://preview.findmydoc.eu/api/forms/contact')
    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(mocks.evaluatePostHogFlags).not.toHaveBeenCalled()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('bypasses known public assets before evaluating PostHog flags', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const faviconResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/favicon.ico'))
    const imageResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/images/holding-page/E105NVPR.jpg'))

    expect(faviconResponse.status).toBe(200)
    expect(imageResponse.status).toBe(200)
    expect(mocks.evaluatePostHogFlags).not.toHaveBeenCalled()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('protects CMS-like image and story paths instead of treating whole prefixes as public assets', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const imagePageResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/images/clinic-page'))
    const storyPageResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/stories/case-study'))

    expect(imagePageResponse.status).toBe(307)
    expect(storyPageResponse.status).toBe(307)
    expect(mocks.evaluatePostHogFlags).toHaveBeenCalledTimes(2)
  })

  it('protects dotted CMS page paths instead of treating every dot path as a public file', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const request = new NextRequest('https://preview.findmydoc.eu/about.v2')
    const response = await proxy(request)
    const location = response.headers.get('location')

    expect(response.status).toBe(307)
    expect(location).toContain('/admin/login')
    expect(location).toContain('message=preview-login-required')
    expect(mocks.evaluatePostHogFlags).toHaveBeenCalled()
  })

  it('matcher excludes API and Next internals without excluding all dotted content paths', () => {
    expect(config.matcher).toContain('/((?!api|_next/static|_next/image|_next/data).*)')
    expect(config.matcher.join(' ')).not.toContain('.*\\..*')
  })
})
