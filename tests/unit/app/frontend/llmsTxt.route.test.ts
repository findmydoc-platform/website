import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const posthogMocks = vi.hoisted(() => ({
  createPostHogHoldingEvaluationContext: vi.fn((input: { url: URL }) => ({
    feature_flag_site_host: input.url.hostname.toLowerCase(),
  })),
  evaluatePostHogFlags: vi.fn(),
  resolvePostHogHoldingFlagActor: vi.fn(),
}))

vi.mock('@/posthog/api', () => posthogMocks)

const authMocks = vi.hoisted(() => ({ getUser: vi.fn() }))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: authMocks.getUser } }),
}))

const getLlmsTxtResponse = async (url = 'https://findmydoc.eu/llms.txt') => {
  const { GET } = await import('@/app/(frontend)/llms.txt/route')
  return GET(new Request(url))
}

const getWellKnownLlmsTxtResponse = async (url = 'https://findmydoc.eu/.well-known/llms.txt') => {
  const { GET } = await import('@/app/(frontend)/.well-known/llms.txt/route')
  return GET(new Request(url))
}

const expectIncludesAll = (content: string, fragments: string[]) => {
  for (const fragment of fragments) {
    expect(content.includes(fragment), fragment).toBe(true)
  }
}

const expectIncludesNone = (content: string, fragments: string[]) => {
  for (const fragment of fragments) {
    expect(content.includes(fragment), fragment).toBe(false)
  }
}

describe('llms.txt routes', () => {
  const originalEnv = process.env
  const actor = {
    distinctId: 'site:production:findmydoc.eu',
    isAuthenticated: false,
    personProperties: {},
    userType: 'anonymous',
  }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
    }
    posthogMocks.resolvePostHogHoldingFlagActor.mockReturnValue(actor)
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      getEvaluation: vi.fn(() => ({ status: 'evaluated', value: false })),
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('serves curated agent context at /llms.txt', async () => {
    const response = await getLlmsTxtResponse()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/markdown')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expectIncludesAll(body, [
      '# findmydoc',
      '## Key URLs',
      '## Public Data Types',
      '## Citation Guidance',
      '## Freshness Policy',
      '## Medical Disclaimer',
      '## Contact Path',
    ])
  })

  it('serves the same content from the optional well-known alias', async () => {
    const rootResponse = await getLlmsTxtResponse()
    const wellKnownResponse = await getWellKnownLlmsTxtResponse()

    expect(wellKnownResponse.status).toBe(200)
    expect(wellKnownResponse.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await wellKnownResponse.text()).toBe(await rootResponse.text())
  })

  it('only exposes canonical public production references', async () => {
    const response = await getLlmsTxtResponse()
    const body = await response.text()

    expectIncludesAll(body, [
      'https://findmydoc.eu/',
      'https://findmydoc.eu/listing-comparison',
      'https://findmydoc.eu/clinics/{clinic-slug}',
      'https://findmydoc.eu/contact',
    ])
    expectIncludesNone(body, [
      'preview.findmydoc.eu',
      '/admin',
      '/api',
      'https://findmydoc.eu/draft',
      'https://findmydoc.eu/unpublished',
    ])
  })

  it('does not expose public discovery content in preview runtime', async () => {
    process.env = {
      ...process.env,
      VERCEL_ENV: 'preview',
    }

    const response = await getLlmsTxtResponse('https://findmydoc.eu/llms.txt')
    const aliasResponse = await getWellKnownLlmsTxtResponse('https://findmydoc.eu/.well-known/llms.txt')
    const body = await response.text()
    const aliasBody = await aliasResponse.text()

    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive')
    expect(body).toBe('')
    expect(aliasResponse.status).toBe(404)
    expect(aliasResponse.headers.get('Cache-Control')).toBe('private, no-store')
    expect(aliasResponse.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive')
    expect(aliasBody).toBe('')
    expect(posthogMocks.evaluatePostHogFlags).not.toHaveBeenCalled()
  })

  it('does not treat a preview host as preview when production runtime is active', async () => {
    const response = await getLlmsTxtResponse('https://preview.findmydoc.eu/llms.txt')
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('# findmydoc')
    expect(body).not.toContain('preview.findmydoc.eu')
    expect(posthogMocks.evaluatePostHogFlags).toHaveBeenCalledOnce()
  })

  it('limits Holding agent context to the home page and published blog on both paths', async () => {
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      getEvaluation: vi.fn(() => ({ status: 'evaluated', value: true })),
    })

    const response = await getLlmsTxtResponse()
    const aliasResponse = await getWellKnownLlmsTxtResponse()

    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/markdown')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('X-Robots-Tag')).toBeNull()
    expectIncludesAll(body, [
      '# findmydoc',
      'https://findmydoc.eu/',
      'https://findmydoc.eu/posts',
      'https://findmydoc.eu/pages-sitemap.xml',
      'https://findmydoc.eu/posts-sitemap.xml',
      '## Citation Guidance',
      '## Freshness Policy',
      'Published public posts',
    ])
    expectIncludesNone(body, [
      '/clinics',
      '/listing-comparison',
      '/about',
      '/contact',
      '/privacy-policy',
      '/imprint',
      '/api',
      'preview.findmydoc.eu',
      '## Contact Path',
    ])
    expect(aliasResponse.status).toBe(200)
    expect(aliasResponse.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await aliasResponse.text()).toBe(body)
  })

  it('keeps Holding discovery scoped through the proxy despite staff access and forged Full markers', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-key'
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      getEvaluation: vi.fn(() => ({ status: 'evaluated', value: true })),
    })
    const { proxy } = await import('@/proxy')
    const routes = [
      { path: '/llms.txt', route: await import('@/app/(frontend)/llms.txt/route') },
      { path: '/.well-known/llms.txt', route: await import('@/app/(frontend)/.well-known/llms.txt/route') },
    ]

    for (const user of [null, { id: 'platform-staff', app_metadata: { user_type: 'platform' } }]) {
      authMocks.getUser.mockResolvedValue({ data: { user }, error: null })

      for (const { path, route } of routes) {
        const request = new NextRequest(`https://findmydoc.eu${path}`, {
          headers: {
            'x-public-site-mode': 'full',
            'x-temporary-landing-mode': '0',
            'x-holding-view': 'public',
          },
        })
        const proxyResponse = await proxy(request)
        expect(proxyResponse.status).toBe(200)

        const forwardedHeaders = new Headers()
        for (const name of proxyResponse.headers.get('x-middleware-override-headers')?.split(',') ?? []) {
          const value = proxyResponse.headers.get(`x-middleware-request-${name}`)
          if (value !== null) forwardedHeaders.set(name, value)
        }
        const response = await route.GET(new Request(request.url, { headers: forwardedHeaders }))
        const body = await response.text()

        expect(response.status).toBe(200)
        expect(body).toContain('This Holding-mode orientation covers the existing home page and published blog.')
        expectIncludesNone(body, ['/clinics', '/listing-comparison', '/about', '/contact', '/api'])
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
      }
    }
  })
})
