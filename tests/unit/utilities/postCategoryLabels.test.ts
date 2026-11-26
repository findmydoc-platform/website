import type { Payload } from 'payload'
import { expect, it, vi } from 'vitest'

vi.mock('@payload-config', () => ({ default: {} }))

import { findPostBySlug } from '@/utilities/content/serverData/posts'

it('loads category titles for the article and its related cards in one request', async () => {
  const find = vi
    .fn()
    .mockResolvedValueOnce({ docs: [{ id: 1, categories: [10, 11], relatedPosts: [2, 3] }] })
    .mockResolvedValueOnce({
      docs: [
        { id: 2, categories: [10] },
        { id: 3, categories: [12] },
      ],
    })
    .mockResolvedValueOnce({
      docs: [
        { id: 10, title: { en: 'Patient Guides' } },
        { id: 11, title: { de: 'Behandlungsplanung' } },
        { id: 12, titleSearch: 'Rehabilitation und Nachsorge' },
      ],
    })
  const payload = { find } as unknown as Payload

  const result = await findPostBySlug(payload, 'nachsorge')

  expect(result).toMatchObject({
    categoryLabel: { title: 'Patient Guides', lang: 'en' },
    relatedPosts: [
      { id: 2, categoryLabel: { title: 'Patient Guides', lang: 'en' } },
      { id: 3, categoryLabel: { title: 'Rehabilitation und Nachsorge', lang: '' } },
    ],
  })
  expect(find.mock.calls.filter(([query]) => query.collection === 'categories')).toEqual([
    [expect.objectContaining({ locale: 'all', where: { id: { in: [10, 11, 12] } } })],
  ])
})
