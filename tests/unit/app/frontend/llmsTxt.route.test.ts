import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    posthogMocks.resolvePostHogSiteFlagActor.mockReturnValue(actor)
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      isEnabled: vi.fn(() => false),
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
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=86400')
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
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive')
    expect(body).toBe('')
    expect(aliasResponse.status).toBe(404)
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

  it('does not expose public discovery content while temporary landing mode is active', async () => {
    posthogMocks.evaluatePostHogFlags.mockResolvedValue({
      isEnabled: vi.fn((key: string) => key === 'temporary-landing-mode'),
    })

    const response = await getLlmsTxtResponse()
    const aliasResponse = await getWellKnownLlmsTxtResponse()

    expect(response.status).toBe(404)
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive')
    expect(await response.text()).toBe('')
    expect(aliasResponse.status).toBe(404)
    expect(aliasResponse.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive')
    expect(await aliasResponse.text()).toBe('')
  })
})
