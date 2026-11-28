import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const payload = vi.hoisted(() => ({
  find: vi.fn(),
  findByID: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => payload) }))
vi.mock('@/features/temporaryLandingMode/resolver', () => ({
  resolveHoldingMode: vi.fn(async () => ({ mode: 'full' })),
}))

import { POST } from '@/app/api/internal/cms-redirects/route'
import { proxy } from '@/proxy'

describe('permanent CMS redirects', () => {
  const origin = 'https://findmydoc.eu'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VERCEL', undefined)
    vi.stubEnv('VERCEL_URL', undefined)
    vi.stubEnv('PAYLOAD_SECRET', 'unit-test-cms-redirect-secret')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => POST(new Request(url, init))),
    )
    payload.find.mockImplementation(async ({ collection }) => ({
      docs:
        collection === 'redirects'
          ? [
              {
                from: '/en/posts/old-article',
                type: '301',
                to: { type: 'reference', reference: { relationTo: 'posts', value: 42 } },
              },
            ]
          : [],
    }))
    payload.findByID.mockResolvedValue({ slug: 'new-article', _status: 'published' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('keeps normal routing available when redirect rules cannot be read', async () => {
    payload.find.mockRejectedValueOnce(new Error('redirect inventory unavailable'))

    const response = await proxy(new NextRequest(`${origin}/current-page`))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('returns an HTTP 301 to the current canonical URL in the original locale', async () => {
    const response = await proxy(new NextRequest(`${origin}/en/posts/old-article`))

    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe(`${origin}/en/posts/new-article`)
  })

  it('temporarily redirects a German-slug English link to the same published English Post', async () => {
    const findOtherwise = payload.find.getMockImplementation()!
    payload.find.mockImplementation(async (args) =>
      args.collection === 'posts' && args.locale === 'de'
        ? { docs: [{ id: 42, slug: 'deutscher-artikel' }] }
        : findOtherwise(args),
    )
    payload.findByID.mockResolvedValue({ slug: 'english-article', _status: 'published' })

    const response = await proxy(new NextRequest(`${origin}/en/posts/deutscher-artikel`))

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(`${origin}/en/posts/english-article`)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('marks a recognizable English path noindex while only the German Page is published', async () => {
    const findOtherwise = payload.find.getMockImplementation()!
    payload.find.mockImplementation(async (args) =>
      args.collection === 'pages' && args.locale === 'de'
        ? { docs: [{ id: 42, slug: 'deutsche-seite' }] }
        : findOtherwise(args),
    )
    payload.findByID.mockResolvedValue({ slug: 'private-english-page', _status: 'draft' })

    const response = await proxy(new NextRequest(`${origin}/en/deutsche-seite`))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
  })

  it('passes through when a Page or Post currently owns that canonical path', async () => {
    const findOtherwise = payload.find.getMockImplementation()!
    payload.find.mockImplementation(async (args) =>
      args.collection === 'posts' ? { docs: [{ id: 77, slug: 'old-article' }] } : findOtherwise(args),
    )

    const response = await proxy(new NextRequest(`${origin}/en/posts/old-article`))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('leaves unrelated stored redirect targets alone for an unknown path', async () => {
    const response = await proxy(new NextRequest(`${origin}/en/posts/current-article`))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it.each(['/about', '/en/patient/favorites'])('leaves dedicated route %s out of CMS redirects', async (path) => {
    const response = await proxy(new NextRequest(`${origin}${path}`))

    expect(response.status).toBe(200)
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('shows a noindex response at a previously public English path after withdrawal', async () => {
    payload.findByID.mockImplementation(async ({ locale }) =>
      locale === 'de' ? { slug: 'german-article', _status: 'published' } : null,
    )

    const response = await proxy(new NextRequest(`${origin}/en/posts/old-article`))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
  })

  it('keeps discovery URLs out of CMS redirect destinations', async () => {
    payload.find.mockResolvedValueOnce({
      docs: [
        {
          from: '/old-page',
          type: '301',
          to: { type: 'reference', reference: { relationTo: 'pages', value: 42 } },
        },
      ],
    })
    payload.findByID.mockResolvedValue({ slug: 'llms.txt', _status: 'published' })

    const response = await proxy(new NextRequest(`${origin}/old-page`))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('does not expose redirect records through anonymous resolver requests', async () => {
    const response = await POST(
      new Request(`${origin}/api/internal/cms-redirects`, {
        method: 'POST',
        body: JSON.stringify({ pathname: '/en/posts/old-article', holding: false }),
      }),
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('uses the deployment origin and does not forward visitor credentials', async () => {
    vi.stubEnv('VERCEL_URL', 'cms-preview.example-deployment.vercel.app')
    const request = new NextRequest('https://visitor-host.example/en/posts/old-article', {
      headers: { authorization: 'Bearer visitor-session', cookie: 'personal=value' },
    })

    const response = await proxy(request)
    expect(response.status).toBe(301)

    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? []
    expect(String(url)).toBe('https://cms-preview.example-deployment.vercel.app/api/internal/cms-redirects')
    const sent = new Headers(init?.headers)
    expect(sent.get('cookie')).toBeNull()
    expect(sent.get('authorization')).toMatch(/^Bearer [a-f0-9]{64}$/)
  })
})
