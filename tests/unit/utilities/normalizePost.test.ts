import { describe, expect, it } from 'vitest'

import { normalizePost } from '@/utilities/blog/normalizePost'

describe('normalizePost', () => {
  it('keeps canonical post hrefs when no content locale is provided', () => {
    const normalized = normalizePost({
      title: 'Hello World',
      slug: 'hello-world',
    })

    expect(normalized.href).toBe('/posts/hello-world')
  })

  it('builds locale-aware post hrefs from the shared content locale context', () => {
    const normalized = normalizePost(
      {
        title: 'Hallo Welt',
        slug: 'hello-world',
      },
      {
        contentLocale: {
          locale: 'de',
          fallbackLocale: 'en',
        },
      },
    )

    expect(normalized.href).toBe('/posts/hello-world?locale=de')
  })
})
