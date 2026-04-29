import { describe, expect, it } from 'vitest'
import { beforeSyncWithSearch } from '@/search/beforeSync'

describe('beforeSyncWithSearch', () => {
  it('removes top-level id from search docs', async () => {
    const result = await beforeSyncWithSearch({
      collectionSlug: 'posts',
      originalDoc: {
        id: 42,
        slug: 'sample-post',
        title: 'Sample Post',
        categories: [],
      },
      payload: {} as never,
      req: {} as never,
      searchDoc: {
        id: '123',
        doc: { relationTo: 'posts', value: '42' },
        title: 'Sample Post',
      },
    })

    expect((result as { id?: unknown }).id).toBeUndefined()
  })

  it('does not inject id into post categories', async () => {
    const result = await beforeSyncWithSearch({
      collectionSlug: 'posts',
      originalDoc: {
        id: 42,
        slug: 'sample-post',
        title: 'Sample Post',
        categories: [{ id: 7, title: 'Guides' }],
      },
      payload: {} as never,
      req: {} as never,
      searchDoc: {
        doc: { relationTo: 'posts', value: '42' },
        title: 'Sample Post',
      },
    })

    const categories = (result as { categories?: Array<Record<string, unknown>> }).categories ?? []
    const firstCategory = categories[0]
    expect(categories).toHaveLength(1)
    expect(firstCategory).toEqual({
      relationTo: 'categories',
      title: 'Guides',
    })
    expect(firstCategory).toBeDefined()
    expect('id' in (firstCategory ?? {})).toBe(false)
  })

  it('serializes localized post fields with default-locale strings for search indexing', async () => {
    const result = await beforeSyncWithSearch({
      collectionSlug: 'posts',
      originalDoc: {
        id: 42,
        slug: 'sample-post',
        title: {
          en: 'English Title',
          de: 'Deutscher Titel',
        },
        meta: {
          title: {
            en: 'English SEO Title',
            de: 'Deutscher SEO-Titel',
          },
          description: {
            en: 'English SEO description.',
            de: 'Deutsche SEO-Beschreibung.',
          },
          image: 17,
        },
        categories: [],
      },
      payload: {} as never,
      req: {} as never,
      searchDoc: {
        doc: { relationTo: 'posts', value: '42' },
      } as never,
    })

    expect(result).toMatchObject({
      slug: 'sample-post',
      title: 'English Title',
      meta: {
        title: 'English SEO Title',
        description: 'English SEO description.',
        image: 17,
      },
    })
  })
})
