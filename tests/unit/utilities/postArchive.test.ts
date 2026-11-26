import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cache: new Map<string, unknown>(),
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('next/cache', () => ({
  unstable_cache:
    (read: (...args: unknown[]) => Promise<unknown>, keyParts: string[]) =>
    async (...args: unknown[]) => {
      const key = JSON.stringify([keyParts, args])
      if (mocks.cache.has(key)) return mocks.cache.get(key)
      const result = await read(...args)
      mocks.cache.set(key, result)
      return result
    },
}))

import { getCachedPostArchivePage } from '@/utilities/content/serverData/posts'

type Locale = 'de' | 'en'
type FindQuery = {
  depth: number
  draft: boolean
  fallbackLocale: false
  locale: Locale
  overrideAccess: boolean
  where: { and?: [{ _status: { equals: string } }, { id: { in: number[] } }]; _status?: { equals: string } }
}

function publication(
  id: number,
  locale: Locale,
  { legacyEnglishSlug, slug = `${locale}-${id}` }: { legacyEnglishSlug?: string; slug?: string } = {},
) {
  return {
    id,
    slug,
    title: `${locale} title ${id}`,
    publishedAt: new Date(Date.UTC(2026, 0, id)).toISOString(),
    updatedAt: '2026-01-15T12:00:00.000Z',
    legacyEnglishSlug,
  }
}

function setup(publications: Record<Locale, ReturnType<typeof publication>[]>) {
  const find = vi.fn(async ({ locale, depth, where, draft, fallbackLocale, overrideAccess }: FindQuery) => {
    expect(draft).toBe(false)
    expect(fallbackLocale).toBe(false)
    expect(overrideAccess).toBe(false)
    expect(where.and?.[0]._status ?? where._status).toEqual({ equals: 'published' })
    const ids = where.and?.[1].id.in
    if (depth === 0) return { docs: publications[locale].map(({ title: _title, ...record }) => record) }
    return { docs: publications[locale].filter(({ id }) => ids?.includes(id)) }
  })
  mocks.getPayload.mockResolvedValue({ find })
  return find
}

const pathOf = ({ canonicalPath }: { canonicalPath: string }) => canonicalPath

describe('public post archive', () => {
  beforeEach(() => {
    mocks.cache.clear()
    vi.clearAllMocks()
  })

  it('paginates unique published posts and selects each available preferred language', async () => {
    setup({
      de: [publication(14, 'de'), publication(12, 'de'), publication(2, 'de'), publication(1, 'de')],
      en: [
        publication(13, 'en'),
        publication(12, 'en'),
        ...Array.from({ length: 10 }, (_, i) => publication(i + 2, 'en')),
      ],
    })

    const [germanFirst, englishFirst, germanSecond, englishSecond] = await Promise.all([
      getCachedPostArchivePage({ preferredLocale: 'de' }),
      getCachedPostArchivePage({ preferredLocale: 'en' }),
      getCachedPostArchivePage({ preferredLocale: 'de', page: 2 }),
      getCachedPostArchivePage({ preferredLocale: 'en', page: 2 }),
    ])

    expect(germanFirst.docs.map(pathOf)).toEqual([
      '/posts/de-14',
      '/en/posts/en-13',
      '/posts/de-12',
      ...[11, 10, 9, 8, 7, 6, 5, 4, 3].map((id) => `/en/posts/en-${id}`),
    ])
    expect(englishFirst.docs.map(pathOf)).toEqual([
      '/posts/de-14',
      '/en/posts/en-13',
      '/en/posts/en-12',
      ...[11, 10, 9, 8, 7, 6, 5, 4, 3].map((id) => `/en/posts/en-${id}`),
    ])
    expect(germanSecond.docs.map(pathOf)).toEqual(['/posts/de-2', '/posts/de-1'])
    expect(englishSecond.docs.map(pathOf)).toEqual(['/en/posts/en-2', '/posts/de-1'])
    expect(englishSecond).toMatchObject({ page: 2, totalDocs: 14, totalPages: 2 })
  })

  it('uses a shared public index when requests point beyond the archive', async () => {
    const find = setup({ de: [publication(1, 'de')], en: [] })

    await expect(getCachedPostArchivePage({ preferredLocale: 'de', page: 3 })).resolves.toMatchObject({
      docs: [],
      totalDocs: 1,
      totalPages: 1,
    })
    await expect(getCachedPostArchivePage({ preferredLocale: 'en', page: 4 })).resolves.toMatchObject({
      docs: [],
      totalDocs: 1,
      totalPages: 1,
    })

    expect(find.mock.calls.map(([query]) => [query.depth, query.locale])).toEqual([
      [0, 'de'],
      [0, 'en'],
    ])
    expect(mocks.cache.size).toBe(1)
  })

  it('keeps a reachable English canonical when a malformed legacy slug overlaps a published German path', async () => {
    setup({
      de: [publication(1, 'de', { slug: 'former' })],
      en: [
        publication(3, 'en', { legacyEnglishSlug: 'former ' }),
        publication(2, 'en', { legacyEnglishSlug: 'legacy' }),
      ],
    })

    const page = await getCachedPostArchivePage({ preferredLocale: 'en' })

    expect(page.docs.map(pathOf)).toEqual(['/en/posts/en-3', '/posts/legacy', '/posts/former'])
  })

  it('keeps the surviving language when publication changes during the card read', async () => {
    const publications = {
      de: [publication(1, 'de'), ...Array.from({ length: 12 }, (_, i) => publication(i + 2, 'de'))],
      en: [publication(1, 'en')],
    }
    const find = setup(publications)
    const read = find.getMockImplementation()!
    let withdrew = false
    find.mockImplementation(async (query) => {
      if (query.depth === 1 && query.locale === 'en' && !withdrew) {
        withdrew = true
        publications.en = []
        mocks.cache.clear()
      }
      return read(query)
    })

    for (let visit = 0; visit < 2; visit++) {
      const page = await getCachedPostArchivePage({ preferredLocale: 'en', page: 2 })
      expect(page.docs.map(pathOf)).toEqual(['/posts/de-1'])
      expect(page).toMatchObject({ page: 2, totalDocs: 13, totalPages: 2 })
    }
    expect(withdrew).toBe(true)
  })
})
