import { readdirSync } from 'node:fs'
import { relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getCachedPublicPostRoute: vi.fn(),
  findPublicPageRoute: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: mocks.headers,
  cookies: async () => ({ get: () => undefined }),
  draftMode: async () => ({ isEnabled: false }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({}) }))
vi.mock('@/utilities/content/serverData', () => ({
  getCachedPublicPostRoute: mocks.getCachedPublicPostRoute,
  findPublicPageRoute: mocks.findPublicPageRoute,
}))
vi.mock('@/app/(frontend)/AdminBarClientAdapter.client', () => ({ AdminBarClientAdapter: () => null }))
vi.mock('@/app/(frontend)/_data/cookieConsent', () => ({
  getCookieConsentConfigs: async () => ({ de: null, en: null }),
}))
vi.mock('@/features/cookieConsent/CookieConsentClientAdapter.client', () => ({
  CookieConsentClientAdapter: () => null,
}))
vi.mock('@vercel/toolbar/next', () => ({ VercelToolbar: () => null }))

async function renderLayout(pathname: string) {
  mocks.headers.mockResolvedValue(new Headers({ 'x-findmydoc-frontend-path': pathname }))
  const { default: RootLayout } = await import('@/app/(frontend)/layout')
  return RootLayout({ children: null })
}

const frontendRoutes = fileURLToPath(new URL('../../../../src/app/(frontend)/', import.meta.url))
const cmsRouteDirectories = new Set(['(pages)/[...slug]', 'posts/[slug]', 'en/posts/[slug]'])
const dedicatedPagePaths = readdirSync(frontendRoutes, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name === 'page.tsx')
  .map((entry) => relative(frontendRoutes, entry.parentPath).split(sep))
  .filter((segments) => !cmsRouteDirectories.has(segments.join('/')))
  .map(
    (segments) =>
      '/' +
      segments
        .filter((segment) => !segment.startsWith('('))
        .map((segment) => (segment.startsWith('[') ? 'route-param' : segment))
        .join('/'),
  )

describe('frontend document language', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('sets the server document language to the rendered German CMS Page', async () => {
    mocks.findPublicPageRoute.mockResolvedValue({ locale: 'de' })

    const layout = await renderLayout('/pflege/deutschland')

    expect(layout.props.lang).toBe('de')
    expect(mocks.findPublicPageRoute).toHaveBeenCalledWith(expect.anything(), 'pflege/deutschland', 'de')
  })

  it('uses the resolved content language for the canonical and legacy Post paths', async () => {
    mocks.getCachedPublicPostRoute
      .mockResolvedValueOnce({ locale: 'de' })
      .mockResolvedValueOnce({ locale: 'en' })
      .mockResolvedValueOnce({ locale: 'en' })

    const german = await renderLayout('/posts/gruener-tee')
    const legacy = await renderLayout('/posts/green-tea')
    const english = await renderLayout('/en/posts/green-tea')

    expect(german.props.lang).toBe('de')
    expect(legacy.props.lang).toBe('en')
    expect(english.props.lang).toBe('en')
    expect(mocks.getCachedPublicPostRoute.mock.calls).toEqual([
      ['gruener-tee', 'de'],
      ['green-tea', 'de'],
      ['green-tea', 'en'],
    ])
  })

  it.each(dedicatedPagePaths)('keeps %s English without looking for a CMS document', async (path) => {
    const layout = await renderLayout(path)

    expect(layout.props.lang).toBe('en')
    expect(mocks.findPublicPageRoute).not.toHaveBeenCalled()
    expect(mocks.getCachedPublicPostRoute).not.toHaveBeenCalled()
  })
})
