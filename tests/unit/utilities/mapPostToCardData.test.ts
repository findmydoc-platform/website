/**
 * Unit tests for mapPostToCardData utility
 */

import { describe, it, expect } from 'vitest'
import { mapPostToCardData } from '@/utilities/mapPostToCardData'
import type { Post, PlatformContentMedia } from '@/payload-types'

describe('mapPostToCardData', () => {
  it('should map a basic post to card data', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [],
      meta: {},
    }

    const result = mapPostToCardData(post)

    expect(result).toEqual({
      title: 'Test Post',
      excerpt: undefined,
      dateLabel: undefined,
      image: undefined,
    })
  })

  it('should include excerpt from meta description', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [],
      meta: {
        description: 'This is a test description',
      },
    }

    const result = mapPostToCardData(post)

    expect(result.excerpt).toBe('This is a test description')
  })

  it('should handle missing description', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [],
      meta: {},
    }

    const result = mapPostToCardData(post)

    expect(result.excerpt).toBeUndefined()
  })

  it('should handle empty string description', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [],
      meta: {
        description: '',
      },
    }

    const result = mapPostToCardData(post)

    // Empty string is converted to undefined by the || operator
    expect(result.excerpt).toBeUndefined()
  })

  it('should map meta image object correctly', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [],
      meta: {
        image: {
          url: '/images/test.jpg',
          alt: 'Test image',
        } as unknown as PlatformContentMedia,
      },
    }

    const result = mapPostToCardData(post)

    expect(result.image).toEqual({
      src: '/images/test.jpg',
      alt: 'Test image',
    })
  })

  it('should handle image with missing optional fields', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [],
      meta: {
        image: {
          url: '/images/test.jpg',
        } as unknown as PlatformContentMedia,
      },
    }

    const result = mapPostToCardData(post)

    expect(result.image).toEqual({
      src: '/images/test.jpg',
      alt: '',
    })
  })

  it('should handle empty string in image url and alt', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [],
      meta: {
        image: {
          url: '',
          alt: '',
        } as unknown as PlatformContentMedia,
      },
    }

    const result = mapPostToCardData(post)

    // Empty strings remain as empty strings for url and alt
    expect(result.image).toEqual({
      src: '',
      alt: '',
    })
  })

  it('should handle non-object meta image', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [],
      meta: {
        image: 'string-not-object' as unknown as PlatformContentMedia,
      },
    }

    const result = mapPostToCardData(post)

    expect(result.image).toBeUndefined()
  })
})
