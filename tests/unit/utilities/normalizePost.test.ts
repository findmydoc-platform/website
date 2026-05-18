import { describe, expect, it } from 'vitest'

import type { PlatformContentMedia } from '@/payload-types'
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

  it('uses original blog card media before thumbnail-only generated sizes', () => {
    const normalized = normalizePost({
      title: 'Hello World',
      slug: 'hello-world',
      heroImage: {
        alt: 'Blog hero image',
        url: '/api/platformContentMedia/file/blog-hero.webp',
        width: 576,
        height: 968,
        sizes: {
          thumbnail: {
            url: '/api/platformContentMedia/file/blog-hero-300x504.webp',
            width: 300,
            height: 504,
          },
        },
      } as PlatformContentMedia,
    })

    expect(normalized.image).toEqual({
      src: '/api/platformContentMedia/file/blog-hero.webp',
      alt: 'Blog hero image',
      width: 576,
      height: 968,
      sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
      quality: 70,
    })
  })
})
