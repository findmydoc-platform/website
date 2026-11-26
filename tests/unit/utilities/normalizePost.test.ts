import { describe, expect, it } from 'vitest'

import type { PlatformContentMedia } from '@/payload-types'
import { normalizePost } from '@/utilities/blog/normalizePost'

describe('normalizePost', () => {
  it('links the current English feed to an English article URL when no locale is given', () => {
    const normalized = normalizePost({
      title: 'Hello World',
      slug: 'hello-world',
    })

    expect(normalized.href).toBe('/en/posts/hello-world')
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

    expect(normalized.href).toBe('/posts/hello-world')
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
      sizes: '(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw',
      quality: 70,
    })
  })
})
