import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import nextConfig from '../../../../next.config.js'

import {
  SEARCH_INDEXING_REQUEST_HEADER,
  SEARCH_ROBOTS_HEADER,
  SEARCH_ROBOTS_HEADER_VALUE,
} from '@/features/searchIndexing'
import {
  HOLDING_VIEW_REQUEST_HEADER,
  PUBLIC_SITE_MODE_REQUEST_HEADER,
  TEMPORARY_LANDING_MODE_REQUEST_HEADER,
} from '@/features/temporaryLandingMode'

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
  logCrawlerRequest: vi.fn(),
  resolveHoldingMode: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}))

vi.mock('@/features/publicDiscovery/crawlerMonitoring', () => ({
  logCrawlerRequest: mocks.logCrawlerRequest,
}))

vi.mock('@/features/temporaryLandingMode/resolver', () => ({
  resolveHoldingMode: mocks.resolveHoldingMode,
}))

import { config, proxy } from '@/proxy'

const mockHoldingMode = (mode: 'holding' | 'full' = 'full') => {
  mocks.resolveHoldingMode.mockResolvedValue({ mode, source: 'posthog' })
}

describe('public site mode proxy', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENVIRONMENT: undefined,
      VERCEL_ENV: undefined,
      VERCEL: undefined,
      NODE_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
      PUBLIC_STATIC_ASSET_PATHS: nextConfig.env?.PUBLIC_STATIC_ASSET_PATHS,
    }

    vi.clearAllMocks()
    mockHoldingMode()

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

  it.each(['/', '/posts', '/posts/article', '/posts/page/2'])(
    'marks anonymous Preview Holding content on %s',
    async (pathname) => {
      process.env.VERCEL_ENV = 'preview'
      mockHoldingMode('holding')
      const response = await proxy(new NextRequest(`https://preview.findmydoc.eu${pathname}`))
      expect(response.status).toBe(200)
      expect(response.headers.get(`x-middleware-request-${PUBLIC_SITE_MODE_REQUEST_HEADER}`)).toBe('holding')
      expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    },
  )

  it('keeps browser-specific page responses private and forwards request cookies to the decision', async () => {
    const request = new NextRequest('https://findmydoc.eu/clinics', { headers: { cookie: 'test=browser' } })
    const response = await proxy(request)
    expect(mocks.resolveHoldingMode).toHaveBeenCalledWith(
      request.nextUrl,
      process.env,
      request.headers,
      expect.any(Function),
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('overwrites visitor-supplied public and viewer mode markers', async () => {
    process.env.VERCEL_ENV = 'production'
    mocks.resolveHoldingMode.mockResolvedValue({ mode: 'holding', source: 'posthog' })
    const request = new NextRequest('https://findmydoc.eu/posts/example', {
      headers: {
        [PUBLIC_SITE_MODE_REQUEST_HEADER]: 'full',
        [TEMPORARY_LANDING_MODE_REQUEST_HEADER]: '1',
        [HOLDING_VIEW_REQUEST_HEADER]: 'standalone',
        [SEARCH_INDEXING_REQUEST_HEADER]: 'noindex',
      },
    })

    const response = await proxy(request)

    expect(response.headers.get(`x-middleware-request-${PUBLIC_SITE_MODE_REQUEST_HEADER}`)).toBe('holding')
    expect(response.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBe('1')
    expect(response.headers.get(`x-middleware-request-${HOLDING_VIEW_REQUEST_HEADER}`)).toBe('public')
    expect(response.headers.get(`x-middleware-request-${SEARCH_INDEXING_REQUEST_HEADER}`)).toBeNull()
  })

  it('logs public discovery crawlers before leaving access to the route contract', async () => {
    process.env.DEPLOYMENT_ENVIRONMENT = 'preview'
    mockHoldingMode()
    const request = new NextRequest('https://preview.findmydoc.eu/llms.txt', {
      headers: {
        'user-agent': 'Googlebot/2.1',
      },
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    expect(mocks.logCrawlerRequest).toHaveBeenCalledWith(request)
    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('does not consult Supabase in local Full mode', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', app_metadata: { user_type: 'clinic' } } },
      error: null,
    })

    const request = new NextRequest('http://localhost:3000/posts/example')
    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(mocks.getUser).not.toHaveBeenCalled()
  })

  it('keeps dynamic content open in Full mode', async () => {
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

  it('keeps the Production Holding root standalone and indexable', async () => {
    process.env.VERCEL_ENV = 'production'
    mockHoldingMode('holding')
    const request = new NextRequest('https://findmydoc.eu/', {
      headers: {
        [HOLDING_VIEW_REQUEST_HEADER]: 'public',
        [PUBLIC_SITE_MODE_REQUEST_HEADER]: 'full',
        [SEARCH_INDEXING_REQUEST_HEADER]: 'noindex',
      },
    })

    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBe('1')
    expect(response.headers.get(`x-middleware-request-${HOLDING_VIEW_REQUEST_HEADER}`)).toBe('standalone')
    expect(response.headers.get(`x-middleware-request-${PUBLIC_SITE_MODE_REQUEST_HEADER}`)).toBe('holding')
    expect(response.headers.get(`x-middleware-request-${SEARCH_INDEXING_REQUEST_HEADER}`)).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBeNull()
  })

  it('returns 404 for non-root routes in temporary landing mode', async () => {
    mockHoldingMode('holding')
    const request = new NextRequest('https://findmydoc.eu/clinics/example')

    const response = await proxy(request)

    expect(response.status).toBe(404)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it.each(['/campaign.png', '/clinics/example.png', '/images/campaign.png', '/stories/campaign.mp4'])(
    'keeps extension-like content on %s governed by the public site mode',
    async (pathname) => {
      const request = new NextRequest(`https://findmydoc.eu${pathname}`)
      mockHoldingMode('holding')

      const holdingResponse = await proxy(request)

      expect(holdingResponse.status).toBe(404)
      expect(holdingResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)

      mockHoldingMode('full')
      const fullResponse = await proxy(request)

      expect(fullResponse.status).toBe(200)
      expect(fullResponse.headers.get(`x-middleware-request-${PUBLIC_SITE_MODE_REQUEST_HEADER}`)).toBe('full')
    },
  )

  it('keeps only exact public blog route shapes reachable in temporary landing mode', async () => {
    mockHoldingMode('holding')

    const allowedPaths = ['/posts', '/posts/', '/posts/example', '/posts/page/2']
    const blockedPaths = ['/posts-admin', '/postscript', '/posts/foo/bar', '/posts/page/0', '/posts/page/2/extra']

    for (const path of allowedPaths) {
      const response = await proxy(new NextRequest(`https://findmydoc.eu${path}`))
      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
      expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBeNull()
      expect(response.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBe('1')
      expect(response.headers.get(`x-middleware-request-${SEARCH_INDEXING_REQUEST_HEADER}`)).toBeNull()
      expect(response.headers.get(`x-middleware-request-${HOLDING_VIEW_REQUEST_HEADER}`)).toBe('public')
    }

    for (const path of blockedPaths) {
      const response = await proxy(new NextRequest(`https://findmydoc.eu${path}`))
      expect(response.status).toBe(404)
      expect(response.headers.get('location')).toBeNull()
      expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    }
  })

  it('applies temporary landing mode to canonical crawl entrypoints', async () => {
    mockHoldingMode('holding')

    const indexableResponses = await Promise.all(
      ['/robots.txt', '/pages-sitemap.xml', '/posts-sitemap.xml', '/llms.txt', '/.well-known/llms.txt'].map((path) =>
        proxy(new NextRequest(`https://findmydoc.eu${path}`)),
      ),
    )
    const blockedResponses = await Promise.all(
      ['/sitemap.xml', '/.well-known/private'].map((path) => proxy(new NextRequest(`https://findmydoc.eu${path}`))),
    )

    expect(indexableResponses.every((response) => response.status === 200)).toBe(true)
    expect(indexableResponses.every((response) => response.headers.get(SEARCH_ROBOTS_HEADER) === null)).toBe(true)
    expect(blockedResponses.every((response) => response.status === 404)).toBe(true)
    expect(
      blockedResponses.every((response) => response.headers.get(SEARCH_ROBOTS_HEADER) === SEARCH_ROBOTS_HEADER_VALUE),
    ).toBe(true)
  })

  it('keeps admin and auth routes reachable in temporary landing mode', async () => {
    mockHoldingMode('holding')

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
      expect(response.headers.get(`x-middleware-request-${HOLDING_VIEW_REQUEST_HEADER}`)).toBe('standalone')
      expect(response.headers.get(`x-middleware-request-${TEMPORARY_LANDING_MODE_REQUEST_HEADER}`)).toBe('1')
      expect(response.headers.get(`x-middleware-request-${SEARCH_INDEXING_REQUEST_HEADER}`)).toBe('noindex')
      expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    }
  })

  it('keeps privacy, imprint, and contact pages reachable in temporary landing mode', async () => {
    mockHoldingMode('holding')

    const privacyRequest = new NextRequest('https://findmydoc.eu/privacy-policy')
    const imprintRequest = new NextRequest('https://findmydoc.eu/imprint')
    const contactRequest = new NextRequest('https://findmydoc.eu/contact', {
      headers: { [SEARCH_INDEXING_REQUEST_HEADER]: 'index' },
    })

    const privacyResponse = await proxy(privacyRequest)
    const imprintResponse = await proxy(imprintRequest)
    const contactResponse = await proxy(contactRequest)

    expect(privacyResponse.status).toBe(200)
    expect(imprintResponse.status).toBe(200)
    expect(contactResponse.status).toBe(200)

    expect(privacyResponse.headers.get(`x-middleware-request-${HOLDING_VIEW_REQUEST_HEADER}`)).toBe('standalone')
    expect(imprintResponse.headers.get(`x-middleware-request-${HOLDING_VIEW_REQUEST_HEADER}`)).toBe('standalone')
    expect(contactResponse.headers.get(`x-middleware-request-${HOLDING_VIEW_REQUEST_HEADER}`)).toBe('standalone')

    expect(privacyResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    expect(imprintResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    expect(contactResponse.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
    for (const response of [privacyResponse, imprintResponse, contactResponse]) {
      expect(response.headers.get(`x-middleware-request-${SEARCH_INDEXING_REQUEST_HEADER}`)).toBe('noindex')
    }
  })

  it('allows platform users to bypass temporary landing mode', async () => {
    mockHoldingMode('holding')
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-2', app_metadata: { user_type: 'platform' } } },
      error: null,
    })

    const request = new NextRequest('https://findmydoc.eu/posts/example')
    const response = await proxy(request)

    expect(response.status).toBe(200)
    expect(response.headers.get(SEARCH_ROBOTS_HEADER)).toBe(SEARCH_ROBOTS_HEADER_VALUE)
  })

  it('passes API preflight requests through without authentication', async () => {
    process.env.VERCEL_ENV = 'preview'

    const response = await proxy(
      new NextRequest('https://preview.findmydoc.eu/api/forms', {
        method: 'OPTIONS',
        headers: { [SEARCH_INDEXING_REQUEST_HEADER]: 'noindex' },
      }),
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get(`x-middleware-request-${SEARCH_INDEXING_REQUEST_HEADER}`)).toBeNull()
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

    expect(mocks.createServerClient).not.toHaveBeenCalled()
  })

  it('serves static public assets without resolving Holding mode', async () => {
    process.env.DEPLOYMENT_ENVIRONMENT = 'preview'
    mockHoldingMode('holding')

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
    const authorPlaceholderResponse = await proxy(
      new NextRequest('https://preview.findmydoc.eu/images/placeholders/author-neutral-placeholder.webp'),
    )

    expect(faviconResponse.status).toBe(200)
    expect(imageResponse.status).toBe(200)
    expect(cssBackgroundResponse.status).toBe(200)
    expect(clinicMapResponse.status).toBe(200)
    expect(registrationPanelResponse.status).toBe(200)
    expect(authorPlaceholderResponse.status).toBe(200)
    expect(mocks.createServerClient).not.toHaveBeenCalled()
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
