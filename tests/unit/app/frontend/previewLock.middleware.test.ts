import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'

import {
  PREVIEW_GUARD_ACTIVE_REQUEST_HEADER,
  PREVIEW_GUARD_LOCK_REQUEST_HEADER,
  PREVIEW_GUARD_PATIENT_REGISTRATION_API_PATH,
} from '@/features/previewGuard'
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
  logCrawlerRequest: vi.fn(),
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

vi.mock('@/features/publicDiscovery/crawlerMonitoring', () => ({
  logCrawlerRequest: mocks.logCrawlerRequest,
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
    vi.unstubAllEnvs()
    process.env = originalEnv
  })

  it('guards generated Vercel Preview hosts without relying on the PostHog flag', async () => {
    process.env.VERCEL_ENV = 'preview'
    const request = new NextRequest('https://findmydoc-portal-git-feature-example.vercel.app/about?foo=bar')

    const response = await proxy(request)
    const location = response.headers.get('location')

    expect(response.status).toBe(307)
    expect(location).toContain('/admin/login')
    expect(location).toContain('message=preview-login-required')
    expect(location).toContain('next=%2Fabout%3Ffoo%3Dbar')
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    expect(mocks.getUser).toHaveBeenCalledOnce()
    expect(mocks.evaluatePostHogFlags).not.toHaveBeenCalled()
  })

  it('passes host and path context into PostHog flag evaluation', async () => {
    process.env.VERCEL_ENV = 'production'
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

  it('logs public discovery crawlers before leaving access to the route contract', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })
    const request = new NextRequest('https://preview.findmydoc.eu/llms.txt', {
      headers: {
        'user-agent': 'Googlebot/2.1',
      },
    })

    const response = await proxy(request)

    expect(response.status).toBe(404)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    expect(mocks.logCrawlerRequest).toHaveBeenCalledWith(request)
    expect(mocks.evaluatePostHogFlags).not.toHaveBeenCalled()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('does not set preview lock headers on exempt routes in local development when flags are disabled', async () => {
    const request = new NextRequest('http://localhost:3000/admin/login')

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBeNull()
  })

  it('does not consult Supabase in local development while guard flags are disabled', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', app_metadata: { user_type: 'clinic' } } },
      error: null,
    })

    const request = new NextRequest('http://localhost:3000/posts/example')
    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(mocks.getUser).not.toHaveBeenCalled()
  })

  it('leaves guards inactive in local development when PostHog evaluation falls back to code defaults', async () => {
    mocks.evaluatePostHogFlags.mockResolvedValue({
      getPayload: vi.fn((_key: GuardFlagKey, fallback: unknown) => fallback),
      getVariant: vi.fn((_key: GuardFlagKey, fallback: string) => fallback),
      isEnabled: vi.fn(() => false),
      keys: ['temporary-landing-mode', 'preview-guard-enabled'],
    })

    const request = new NextRequest('http://localhost:3000/posts/example')
    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBeNull()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('uses the preview guard flag regardless of production runtime', async () => {
    process.env.VERCEL_ENV = 'production'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const request = new NextRequest('https://findmydoc.eu/about')
    const response = await proxy(request)
    const location = response.headers.get('location')

    expect(response.status).toBe(307)
    expect(location).toContain('/admin/login')
    expect(location).toContain('message=preview-login-required')
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('keeps local development open even when PostHog returns the guard flag', async () => {
    mockGuardFlags({ 'preview-guard-enabled': true })

    const response = await proxy(new NextRequest('http://localhost:3000/about'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBeNull()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('redirects unauthenticated users when preview guard flag is enabled in preview runtime', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const request = new NextRequest('https://preview.findmydoc.eu/about?foo=bar')
    const response = await proxy(request)
    const location = response.headers.get('location')

    expect(response.status).toBe(307)
    expect(location).toContain('/admin/login')
    expect(location).toContain('message=preview-login-required')
    expect(location).toContain('next=%2Fabout%3Ffoo%3Dbar')
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

  it('keeps the exact patient auth lifecycle reachable without a staff session', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const allowedPaths = [
      '/login/patient',
      '/auth/password/reset',
      '/auth/callback',
      '/auth/confirm?type=recovery',
      '/auth/password/reset/complete',
      '/auth/invite/complete',
      '/admin/logout',
      '/logout',
    ]

    for (const path of allowedPaths) {
      const response = await proxy(new NextRequest(`https://preview.findmydoc.eu${path}`))

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
      expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_ACTIVE_REQUEST_HEADER}`)).toBe('1')
      expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
      expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    }
  })

  it('keeps patient self-registration behind the staff preview guard', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const response = await proxy(new NextRequest('https://preview.findmydoc.eu/register/patient'))
    const location = response.headers.get('location')

    expect(response.status).toBe(307)
    expect(location).toContain('/admin/login')
    expect(location).toContain('next=%2Fregister%2Fpatient')
  })

  it('forwards the active guard state to staff opening patient registration', async () => {
    process.env.VERCEL_ENV = 'production'
    mockGuardFlags({ 'preview-guard-enabled': true })
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'platform-1', app_metadata: { user_type: 'platform' } } },
      error: null,
    })

    const response = await proxy(new NextRequest('https://findmydoc.eu/register/patient'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_ACTIVE_REQUEST_HEADER}`)).toBe('1')
  })

  it('redirects anonymous patient routes to the patient login with a safe next path', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const response = await proxy(new NextRequest('https://preview.findmydoc.eu/patient/favorites?from=account-menu'))
    const location = response.headers.get('location')

    expect(response.status).toBe(307)
    expect(location).toContain('/login/patient')
    expect(location).toContain('next=%2Fpatient%2Ffavorites%3Ffrom%3Daccount-menu')
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('allows patient sessions only on patient routes', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'patient-1', app_metadata: { user_type: 'patient' } } },
      error: null,
    })

    const patientResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/patient/favorites'))
    const adminResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/admin'))

    expect(patientResponse.status).toBe(200)
    expect(patientResponse.headers.get('location')).toBeNull()
    expect(patientResponse.headers.get(`x-middleware-request-${PREVIEW_GUARD_ACTIVE_REQUEST_HEADER}`)).toBe('1')
    expect(patientResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)

    expect(adminResponse.status).toBe(307)
    expect(adminResponse.headers.get('location')).toContain('/admin/login')
  })

  it('does not grant clinic sessions access to patient routes', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'clinic-1', app_metadata: { user_type: 'clinic' } } },
      error: null,
    })

    const response = await proxy(new NextRequest('https://preview.findmydoc.eu/patient/favorites'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/admin/login')
  })

  it('returns 404 for first-admin bootstrap paths before preview guard redirects', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const firstAdminResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/admin/first-admin'))
    const createFirstUserResponse = await proxy(
      new NextRequest('https://preview.findmydoc.eu/admin/create-first-user/'),
    )

    expect(firstAdminResponse.status).toBe(404)
    expect(firstAdminResponse.headers.get('location')).toBeNull()
    expect(firstAdminResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)

    expect(createFirstUserResponse.status).toBe(404)
    expect(createFirstUserResponse.headers.get('location')).toBeNull()
    expect(createFirstUserResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('returns 404 for scanner paths before flag evaluation or authentication', async () => {
    process.env.VERCEL_ENV = 'preview'

    for (const path of ['/.env.local', '/.git/config', '/dump.sql', '/actuator/env']) {
      const response = await proxy(new NextRequest(`https://preview-deployment.vercel.app${path}`))

      expect(response.status, path).toBe(404)
      expect(response.headers.get('location'), path).toBeNull()
      expect(response.headers.get(SEARCH_ROBOTS_HEADER), path).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    }

    expect(mocks.evaluatePostHogFlags).not.toHaveBeenCalled()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('returns 404 for anonymous dynamic CMS paths without starting authentication', async () => {
    process.env.VERCEL_ENV = 'preview'

    for (const path of ['/not-a-real-page', '/clinics/not-known', '/posts/not-known']) {
      const response = await proxy(new NextRequest(`https://preview-deployment.vercel.app${path}`))

      expect(response.status, path).toBe(404)
      expect(response.headers.get('location'), path).toBeNull()
      expect(response.headers.get(SEARCH_ROBOTS_HEADER), path).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    }

    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('does not let CMS paths that share an internal prefix bypass the guard', async () => {
    process.env.VERCEL_ENV = 'preview'

    for (const path of ['/apiary', '/_nextish']) {
      const response = await proxy(new NextRequest(`https://preview-deployment.vercel.app${path}`))

      expect(response.status, path).toBe(404)
      expect(response.headers.get('location'), path).toBeNull()
    }
  })

  it('allows an authenticated platform user to open a valid dynamic CMS deep link', async () => {
    process.env.VERCEL_ENV = 'preview'
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'platform-2', app_metadata: { user_type: 'platform' } } },
      error: null,
    })

    const response = await proxy(
      new NextRequest('https://preview-deployment.vercel.app/nested/cms-page', {
        headers: { cookie: 'sb-synthetic-auth-token=platform-session' },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_ACTIVE_REQUEST_HEADER}`)).toBe('1')
    expect(mocks.getUser).toHaveBeenCalledOnce()
  })

  it('keeps dynamic content open outside guarded runtimes', async () => {
    const localResponse = await proxy(new NextRequest('http://localhost:3000/nested/cms-page'))

    vi.stubEnv('NODE_ENV', 'production')
    process.env.VERCEL_ENV = 'production'
    const productionResponse = await proxy(new NextRequest('https://findmydoc.eu/nested/cms-page'))

    expect(localResponse.status).toBe(200)
    expect(localResponse.headers.get('location')).toBeNull()
    expect(productionResponse.status).toBe(200)
    expect(productionResponse.headers.get('location')).toBeNull()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
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
    const request = new NextRequest('https://findmydoc.eu/clinics/example')

    const response = await proxy(request)

    expect(response.status).toBe(404)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('keeps only exact public blog route shapes reachable in temporary landing mode', async () => {
    mockGuardFlags({ 'temporary-landing-mode': true })

    const allowedPaths = ['/posts', '/posts/', '/posts/example', '/posts/page/2']
    const blockedPaths = ['/posts-admin', '/postscript', '/posts/foo/bar', '/posts/page/0', '/posts/page/2/extra']

    for (const path of allowedPaths) {
      const response = await proxy(new NextRequest(`https://findmydoc.eu${path}`))
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
      expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
      expect(response.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBe('1')
      expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBe('1')
    }

    for (const path of blockedPaths) {
      const response = await proxy(new NextRequest(`https://findmydoc.eu${path}`))
      expect(response.status).toBe(404)
      expect(response.headers.get('location')).toBeNull()
      expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    }
  })

  it('applies temporary landing mode to canonical crawl entrypoints', async () => {
    mockGuardFlags({ 'temporary-landing-mode': true })

    const responses = await Promise.all(
      ['/robots.txt', '/sitemap.xml', '/llms.txt', '/.well-known/llms.txt'].map((path) =>
        proxy(new NextRequest(`https://findmydoc.eu${path}`)),
      ),
    )

    expect(responses.every((response) => response.status === 404)).toBe(true)
    expect(
      responses.every((response) => response.headers.get(SEARCH_ROBOTS_HEADER) === SEARCH_ROBOTS_HEADER_VALUE),
    ).toBe(true)
    expect(mocks.evaluatePostHogFlags).toHaveBeenCalledTimes(4)
  })

  it('keeps admin and auth routes reachable in temporary landing mode', async () => {
    mockGuardFlags({ 'temporary-landing-mode': true })

    const requests = [
      new NextRequest('https://findmydoc.eu/admin/login'),
      new NextRequest('https://findmydoc.eu/admin'),
      new NextRequest('https://findmydoc.eu/admin/account'),
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

  it('keeps first-admin bootstrap paths blocked in temporary landing mode', async () => {
    mockGuardFlags({ 'temporary-landing-mode': true })

    const firstAdminResponse = await proxy(new NextRequest('https://findmydoc.eu/admin/first-admin'))
    const createFirstUserResponse = await proxy(new NextRequest('https://findmydoc.eu/admin/create-first-user'))

    expect(firstAdminResponse.status).toBe(404)
    expect(firstAdminResponse.headers.get('location')).toBeNull()
    expect(firstAdminResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)

    expect(createFirstUserResponse.status).toBe(404)
    expect(createFirstUserResponse.headers.get('location')).toBeNull()
    expect(createFirstUserResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
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

  it('keeps the Preview Guard closed allowlist when temporary landing mode is also active', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true, 'temporary-landing-mode': true })

    const privacyRequest = new NextRequest('https://preview.findmydoc.eu/privacy-policy')
    const imprintRequest = new NextRequest('https://preview.findmydoc.eu/imprint')
    const contactRequest = new NextRequest('https://preview.findmydoc.eu/contact')

    const privacyResponse = await proxy(privacyRequest)
    const imprintResponse = await proxy(imprintRequest)
    const contactResponse = await proxy(contactRequest)

    expect(privacyResponse.status).toBe(404)
    expect(imprintResponse.status).toBe(404)
    expect(contactResponse.status).toBe(307)

    expect(privacyResponse.headers.get('location')).toBeNull()
    expect(imprintResponse.headers.get('location')).toBeNull()
    expect(contactResponse.headers.get('location')).toContain('/admin/login')

    expect(privacyResponse.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBeNull()
    expect(imprintResponse.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBeNull()
    expect(contactResponse.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBeNull()

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

  it('keeps anonymous dynamic content hidden when both guards are active', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true, 'temporary-landing-mode': true })

    const request = new NextRequest('https://preview.findmydoc.eu/posts/example')
    const response = await proxy(request)

    expect(response.status).toBe(404)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    expect(response.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBeNull()
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBeNull()
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

  it('keeps patient login and patient routes usable when both guards are active', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true, 'temporary-landing-mode': true })

    const loginResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/login/patient'))
    const anonymousPatientResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/patient/favorites'))

    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'patient-2', app_metadata: { user_type: 'patient' } } },
      error: null,
    })
    const authenticatedPatientResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/patient/favorites'))

    expect(loginResponse.status).toBe(200)
    expect(loginResponse.headers.get('location')).toBeNull()
    expect(anonymousPatientResponse.status).toBe(307)
    expect(anonymousPatientResponse.headers.get('location')).toContain('/login/patient')
    expect(authenticatedPatientResponse.status).toBe(200)
    expect(authenticatedPatientResponse.headers.get('location')).toBeNull()
    expect(authenticatedPatientResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('returns JSON 401 for anonymous public Payload APIs in Preview', async () => {
    process.env.VERCEL_ENV = 'preview'
    const request = new NextRequest('https://preview.findmydoc.eu/api/forms?limit=1')
    const response = await proxy(request)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Authorization, Cookie')
    expect(mocks.evaluatePostHogFlags).not.toHaveBeenCalled()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
    expect(mocks.logCrawlerRequest).not.toHaveBeenCalled()
  })

  it('rejects a forged Supabase Bearer token before Payload can handle the API request', async () => {
    process.env.VERCEL_ENV = 'preview'
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { name: 'AuthApiError', status: 401 },
    })

    const response = await proxy(
      new NextRequest('https://preview.findmydoc.eu/api/pages', {
        headers: { authorization: 'Bearer forged-token' },
      }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(response.headers.get('location')).toBeNull()
    expect(mocks.getUser).toHaveBeenCalledWith('forged-token')
  })

  it('passes a Supabase-authenticated Bearer request to endpoint authorization', async () => {
    process.env.VERCEL_ENV = 'preview'
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: { id: 'platform-api-1', email: 'platform@example.com', app_metadata: { user_type: 'platform' } },
      },
      error: null,
    })

    const response = await proxy(
      new NextRequest('https://preview.findmydoc.eu/api/pages', {
        headers: { authorization: 'Bearer verified-supabase-token' },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_ACTIVE_REQUEST_HEADER}`)).toBe('1')
    expect(mocks.getUser).toHaveBeenCalledWith('verified-supabase-token')
  })

  it('passes a Supabase-authenticated platform cookie to endpoint authorization', async () => {
    process.env.VERCEL_ENV = 'preview'
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: { id: 'platform-api-2', email: 'platform2@example.com', app_metadata: { user_type: 'platform' } },
      },
      error: null,
    })

    const response = await proxy(
      new NextRequest('https://preview.findmydoc.eu/api/graphql', {
        headers: { cookie: 'sb-synthetic-auth-token=platform-session' },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_ACTIVE_REQUEST_HEADER}`)).toBe('1')
    expect(mocks.getUser).toHaveBeenCalledWith()
  })

  it('rejects an authenticated Supabase principal outside known application user types', async () => {
    process.env.VERCEL_ENV = 'preview'
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: { id: 'unknown-api-user', email: 'unknown@example.com', app_metadata: { user_type: 'external' } },
      },
      error: null,
    })

    const response = await proxy(
      new NextRequest('https://preview.findmydoc.eu/api/pages', {
        headers: { authorization: 'Bearer valid-but-unknown-user-token' },
      }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns JSON 503 when Supabase identifies a retryable authentication outage', async () => {
    process.env.VERCEL_ENV = 'preview'
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { name: 'AuthRetryableFetchError', status: 503 },
    })

    const response = await proxy(
      new NextRequest('https://preview.findmydoc.eu/api/pages', {
        headers: { authorization: 'Bearer temporarily-unverifiable-token' },
      }),
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication service unavailable' })
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Authorization, Cookie')
  })

  it('treats rate limits and network-shaped Supabase failures as temporary', async () => {
    process.env.VERCEL_ENV = 'preview'

    for (const error of [{ status: 0 }, { status: 429 }, { message: 'Network error while validating session' }]) {
      mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error })
      const response = await proxy(
        new NextRequest('https://preview.findmydoc.eu/api/pages', {
          headers: { authorization: 'Bearer temporarily-unverifiable-token' },
        }),
      )

      expect(response.status, JSON.stringify(error)).toBe(503)
    }
  })

  it('keeps the exact anonymous API allowlist reachable in Preview', async () => {
    process.env.VERCEL_ENV = 'preview'

    for (const path of ['/api/auth/login', '/api/auth/callback', '/api/auth/password/reset']) {
      const response = await proxy(new NextRequest(`https://preview.findmydoc.eu${path}`))

      expect(response.status, path).toBe(200)
      expect(response.headers.get('location'), path).toBeNull()
    }

    const nearMatch = await proxy(new NextRequest('https://preview.findmydoc.eu/api/auth/login/help'))
    expect(nearMatch.status).toBe(401)
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('delegates explicit machine APIs to their own authentication contracts', async () => {
    process.env.VERCEL_ENV = 'preview'

    for (const path of ['/api/mcp', '/api/clinic-dashboard/reviews']) {
      const response = await proxy(
        new NextRequest(`https://preview.findmydoc.eu${path}`, {
          headers: { authorization: 'Bearer endpoint-owned-machine-token' },
        }),
      )

      expect(response.status, path).toBe(200)
      expect(response.headers.get('location'), path).toBeNull()
      expect(response.headers.get('x-middleware-request-authorization'), path).toBe(
        'Bearer endpoint-owned-machine-token',
      )
    }

    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('passes API preflight requests through without authentication', async () => {
    process.env.VERCEL_ENV = 'preview'

    const response = await proxy(
      new NextRequest('https://preview.findmydoc.eu/api/forms', {
        method: 'OPTIONS',
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('leaves APIs unchanged outside Vercel Preview deployments', async () => {
    const localResponse = await proxy(new NextRequest('http://localhost:3000/api/forms'))

    process.env.VERCEL_ENV = 'production'
    mockGuardFlags({ 'preview-guard-enabled': true })
    const productionResponse = await proxy(new NextRequest('https://findmydoc.eu/api/forms'))

    expect(localResponse.status).toBe(200)
    expect(productionResponse.status).toBe(200)
    expect(mocks.evaluatePostHogFlags).not.toHaveBeenCalled()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('keeps PostHog-controlled patient registration locking outside Vercel Preview', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.VERCEL_ENV = 'production'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const response = await proxy(
      new NextRequest(`https://findmydoc.eu${PREVIEW_GUARD_PATIENT_REGISTRATION_API_PATH}`, {
        method: 'POST',
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_ACTIVE_REQUEST_HEADER}`)).toBe('1')
    expect(mocks.evaluatePostHogFlags).toHaveBeenCalledOnce()
  })

  it('rejects scanner API paths before forwarding authenticated APIs to endpoint authorization', async () => {
    process.env.VERCEL_ENV = 'preview'

    const scannerResponse = await proxy(
      new NextRequest('https://preview-deployment.vercel.app/api/exec', { method: 'OPTIONS' }),
    )
    const clinicDashboardResponse = await proxy(
      new NextRequest('https://preview-deployment.vercel.app/api/clinic-dashboard/reviews', {
        headers: { authorization: 'Bearer clinic-dashboard-token' },
      }),
    )

    expect(scannerResponse.status).toBe(404)
    expect(scannerResponse.headers.get('location')).toBeNull()
    expect(clinicDashboardResponse.status).toBe(200)
    expect(clinicDashboardResponse.headers.get('location')).toBeNull()
    expect(config.matcher.join(' ')).toContain('/api/:path*')
    expect(mocks.evaluatePostHogFlags).not.toHaveBeenCalled()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('forwards non-page route handlers without an HTML login redirect', async () => {
    process.env.VERCEL_ENV = 'preview'

    const paths = ['/next/preview?previewSecret=invalid', '/next/exit-preview']

    for (const path of paths) {
      const response = await proxy(new NextRequest(`https://preview-deployment.vercel.app${path}`))

      expect(response.status, path).toBe(200)
      expect(response.headers.get('location'), path).toBeNull()
    }

    expect(mocks.evaluatePostHogFlags).not.toHaveBeenCalled()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('forwards the active Preview Guard state to the patient registration API', async () => {
    process.env.VERCEL_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })
    const request = new NextRequest(`https://preview.findmydoc.eu${PREVIEW_GUARD_PATIENT_REGISTRATION_API_PATH}`, {
      method: 'POST',
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_ACTIVE_REQUEST_HEADER}`)).toBe('1')
    expect(mocks.evaluatePostHogFlags).not.toHaveBeenCalled()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('removes spoofed guard headers when Preview Guard is inactive', async () => {
    const request = new NextRequest(`https://preview.findmydoc.eu${PREVIEW_GUARD_PATIENT_REGISTRATION_API_PATH}`, {
      method: 'POST',
      headers: {
        [PREVIEW_GUARD_ACTIVE_REQUEST_HEADER]: '1',
        [PREVIEW_GUARD_LOCK_REQUEST_HEADER]: '1',
        [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1',
      },
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_ACTIVE_REQUEST_HEADER}`)).toBeNull()
    expect(response.headers.get(`x-middleware-request-${PREVIEW_GUARD_LOCK_REQUEST_HEADER}`)).toBeNull()
    expect(response.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBeNull()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('bypasses known public assets before evaluating PostHog flags', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const faviconResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/favicon.ico'))
    const imageResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/images/holding-page/E105NVPR.jpg'))
    const cssBackgroundResponse = await proxy(
      new NextRequest('https://preview.findmydoc.eu/images/blog-header-clinic-reception.webp'),
    )
    const clinicMapResponse = await proxy(
      new NextRequest('https://preview.findmydoc.eu/images/clinic-detail/clinic-location-placeholder-map.webp'),
    )
    const registrationPanelResponse = await proxy(
      new NextRequest('https://preview.findmydoc.eu/images/clinic-registration-funnel-panel.webp'),
    )

    expect(faviconResponse.status).toBe(200)
    expect(imageResponse.status).toBe(200)
    expect(cssBackgroundResponse.status).toBe(200)
    expect(clinicMapResponse.status).toBe(200)
    expect(registrationPanelResponse.status).toBe(200)
    expect(mocks.evaluatePostHogFlags).not.toHaveBeenCalled()
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('returns 404 for anonymous CMS-like image and story paths instead of treating prefixes as assets', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const imagePageResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/images/clinic-page'))
    const storyPageResponse = await proxy(new NextRequest('https://preview.findmydoc.eu/stories/case-study'))

    expect(imagePageResponse.status).toBe(404)
    expect(storyPageResponse.status).toBe(404)
    expect(mocks.evaluatePostHogFlags).not.toHaveBeenCalled()
  })

  it('returns 404 for anonymous dotted CMS page paths instead of treating them as files', async () => {
    process.env.DEPLOYMENT_ENV = 'preview'
    mockGuardFlags({ 'preview-guard-enabled': true })

    const request = new NextRequest('https://preview.findmydoc.eu/about.v2')
    const response = await proxy(request)
    expect(response.status).toBe(404)
    expect(response.headers.get('location')).toBeNull()
    expect(mocks.evaluatePostHogFlags).not.toHaveBeenCalled()
  })

  it('matcher includes API inspection while excluding Next internals and dotted content paths', () => {
    expect(config.matcher).toContain('/api/:path*')
    expect(config.matcher).toContain('/((?!api(?:/|$)|_next/static|_next/image|_next/data).*)')
    expect(config.matcher.join(' ')).not.toContain('.*\\..*')
  })

  it('matches API routes and CMS slugs that only share an internal route prefix', () => {
    for (const url of ['/api', '/api/clinics', '/apiary', '/apiary/clinic', '/_nextish']) {
      expect(unstable_doesMiddlewareMatch({ config, url }), url).toBe(true)
    }

    for (const url of ['/_next/static/chunks/app.js', '/_next/image']) {
      expect(unstable_doesMiddlewareMatch({ config, url }), url).toBe(false)
    }
  })
})
