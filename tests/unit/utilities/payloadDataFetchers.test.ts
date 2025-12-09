/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCachedDocument } from '@/utilities/getDocument'
import { getGlobal, getCachedGlobal } from '@/utilities/getGlobals'
import { getRedirects, getCachedRedirects } from '@/utilities/getRedirects'

const { getPayloadMock, unstableCacheMock } = vi.hoisted(() => ({
  getPayloadMock: vi.fn(),
  unstableCacheMock: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {} as any,
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

  describe('getCachedDocument', () => {
    it('fetches documents through Payload and registers cache tags', async () => {
      const findMock = vi.fn().mockResolvedValue({ docs: [{ slug: 'home' }] })
      getPayloadMock.mockResolvedValue({ find: findMock })

      const cachedLoader = getCachedDocument('pages' as any, 'home')

      expect(unstableCacheMock).toHaveBeenCalledWith(expect.any(Function), ['pages', 'home'], { tags: ['pages_home'] })

      const result = await cachedLoader()

      expect(findMock).toHaveBeenCalledWith({
        collection: 'pages',
        depth: 0,
        where: { slug: { equals: 'home' } },
      })
      expect(result).toEqual({ slug: 'home' })
    })
  })

  describe('getGlobal', () => {
    it('fetches globals with the requested depth', async () => {
      const findGlobalMock = vi.fn().mockResolvedValue({ hero: 'content' })
      getPayloadMock.mockResolvedValue({ findGlobal: findGlobalMock })

      const globalDoc = await getGlobal('settings' as any, 1)

      expect(findGlobalMock).toHaveBeenCalledWith({ slug: 'settings', depth: 1 })
      expect(globalDoc).toEqual({ hero: 'content' })
    })

    it('wraps global fetches with caching metadata', async () => {
      const findGlobalMock = vi.fn().mockResolvedValue({ footer: 'data' })
      getPayloadMock.mockResolvedValue({ findGlobal: findGlobalMock })

      const cachedGlobal = getCachedGlobal('settings' as any, 3)

      expect(unstableCacheMock).toHaveBeenCalledWith(expect.any(Function), ['settings'], { tags: ['global_settings'] })

      const result = await cachedGlobal()
      expect(findGlobalMock).toHaveBeenCalledWith({ slug: 'settings', depth: 3 })
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
        tags: ['redirects'],
      })

      const result = await cachedRedirects()

      expect(findMock).toHaveBeenCalledWith({
        collection: 'redirects',
        depth: 1,
        limit: 0,
        pagination: false,
      })
      expect(result).toEqual([])
    })
  })
})
