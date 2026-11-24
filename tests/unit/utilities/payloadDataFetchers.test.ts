import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getGlobal, getCachedGlobal } from '@/utilities/getGlobals'
import { getRedirects, getCachedRedirects } from '@/utilities/getRedirects'
import type { GlobalSlug } from 'payload'

const { getPayloadMock, unstableCacheMock } = vi.hoisted(() => ({
  getPayloadMock: vi.fn(),
  unstableCacheMock: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {} as unknown as Record<string, unknown>,
}))

vi.mock('payload', () => ({
  getPayload: getPayloadMock,
}))

vi.mock('next/cache', () => ({
  unstable_cache: unstableCacheMock,
}))

describe('Payload-backed utilities', () => {
  beforeEach(() => {
    getPayloadMock.mockReset()
    unstableCacheMock.mockReset()
    unstableCacheMock.mockImplementation((fn) => fn)
  })

  describe('getGlobal', () => {
    it('keeps existing English Page references populated in shared navigation', async () => {
      const englishPage = { id: 1, slug: 'privacy-policy' }
      const findGlobalMock = vi.fn(({ locale }) => ({
        navItems: [{ link: { reference: { relationTo: 'pages', value: locale === 'en' ? englishPage : 1 } } }],
      }))
      getPayloadMock.mockResolvedValue({ findGlobal: findGlobalMock })

      const globalDoc = await getGlobal('header' as GlobalSlug, 1)

      expect(findGlobalMock).toHaveBeenCalledWith({
        slug: 'header',
        depth: 1,
        locale: 'en',
        fallbackLocale: false,
        overrideAccess: false,
      })
      expect(globalDoc).toEqual({
        navItems: [{ link: { reference: { relationTo: 'pages', value: englishPage } } }],
      })
    })

    it('expires landing content when a referenced Page or Post is published or withdrawn', async () => {
      const findGlobal = vi.fn().mockResolvedValue({ home: {} })
      getPayloadMock.mockResolvedValue({ findGlobal })

      await getCachedGlobal('landingPages', 2)()

      expect(unstableCacheMock).toHaveBeenCalledWith(expect.any(Function), expect.any(Array), {
        tags: ['global:landingPages', 'collection:pages', 'collection:posts'],
      })
      expect(findGlobal).toHaveBeenCalledWith({ slug: 'landingPages', depth: 2, overrideAccess: false })
    })

    it('loads populated footer references anonymously and invalidates them when their publications change', async () => {
      const findGlobalMock = vi.fn().mockResolvedValue({ footer: 'data' })
      getPayloadMock.mockResolvedValue({ findGlobal: findGlobalMock })

      const cachedGlobal = getCachedGlobal('footer' as GlobalSlug, 3)

      expect(unstableCacheMock).toHaveBeenCalledWith(expect.any(Function), [expect.any(String), 'footer', '3'], {
        tags: ['global:footer', 'collection:pages', 'collection:posts'],
      })

      const result = await cachedGlobal()
      expect(findGlobalMock).toHaveBeenCalledWith({
        slug: 'footer',
        depth: 3,
        locale: 'en',
        fallbackLocale: false,
        overrideAccess: false,
      })
      expect(result).toEqual({ footer: 'data' })
    })
  })

  describe('getRedirects', () => {
    it('returns redirects with pagination disabled', async () => {
      const findMock = vi.fn().mockResolvedValue({ docs: [{ from: '/old', to: '/new' }] })
      getPayloadMock.mockResolvedValue({ find: findMock })

      const redirects = await getRedirects(4)

      expect(findMock).toHaveBeenCalledWith({
        collection: 'redirects',
        depth: 4,
        limit: 0,
        pagination: false,
      })
      expect(redirects).toEqual([{ from: '/old', to: '/new' }])
    })

    it('caches redirect lookups with shared tags', async () => {
      const findMock = vi.fn().mockResolvedValue({ docs: [] })
      getPayloadMock.mockResolvedValue({ find: findMock })

      const cachedRedirects = getCachedRedirects()

      expect(unstableCacheMock).toHaveBeenCalledWith(expect.any(Function), ['redirects'], {
        tags: ['collection:redirects', 'surface:redirects'],
      })

      const result = await cachedRedirects()

      expect(findMock).toHaveBeenCalledWith({
        collection: 'redirects',
        depth: 0,
        limit: 0,
        pagination: false,
      })
      expect(result).toEqual([])
    })
  })
})
