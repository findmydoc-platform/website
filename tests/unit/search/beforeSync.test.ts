import { describe, expect, it } from 'vitest'
import { beforeSyncWithSearch } from '@/search/beforeSync'

describe('beforeSyncWithSearch', () => {
  it('removes top-level id from search docs', async () => {
    const result = await beforeSyncWithSearch({
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
    expect(categories).toHaveLength(1)
    expect(categories[0]).toEqual({
      relationTo: 'categories',
      title: 'Guides',
    })
    expect('id' in categories[0]).toBe(false)
  })
})
