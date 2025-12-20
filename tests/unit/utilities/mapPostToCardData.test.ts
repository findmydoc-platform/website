/**
 * Unit tests for mapPostToCardData utility
 */

import { describe, it, expect } from 'vitest'
import { mapPostToCardData } from '@/utilities/mapPostToCardData'
import type { Post } from '@/payload-types'

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
      href: '/posts/test-post',
      description: undefined,
      image: undefined,
      categories: [],
    })
  })

  it('should include description from meta', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [],
      meta: {
        description: 'This is a test description',
      },
    }

    const result = mapPostToCardData(post)

    expect(result.description).toBe('This is a test description')
  })

  it('should handle missing description', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [],
      meta: {},
    }

    const result = mapPostToCardData(post)

    expect(result.description).toBeUndefined()
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
          width: 800,
          height: 600,
        },
      },
    }

    const result = mapPostToCardData(post)

    expect(result.image).toEqual({
      src: '/images/test.jpg',
      alt: 'Test image',
      width: 800,
      height: 600,
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
        },
      },
    }

    const result = mapPostToCardData(post)

    expect(result.image).toEqual({
      src: '/images/test.jpg',
      alt: '',
      width: undefined,
      height: undefined,
    })
  })

  it('should handle non-object meta image', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [],
      meta: {
        image: 'string-not-object' as unknown as Record<string, unknown>,
      },
    }

    const result = mapPostToCardData(post)

    expect(result.image).toBeUndefined()
  })

  it('should map category objects to titles', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [
        { id: 1, title: 'Technology' } as unknown as number,
        { id: 2, title: 'Science' } as unknown as number,
      ],
      meta: {},
    }

    const result = mapPostToCardData(post)

    expect(result.categories).toEqual(['Technology', 'Science'])
  })

  it('should filter out non-object categories', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [
        { id: 1, title: 'Technology' } as unknown as number,
        'string-id' as unknown as number,
        123 as unknown as number,
      ],
      meta: {},
    }

    const result = mapPostToCardData(post)

    expect(result.categories).toEqual(['Technology'])
  })

  it('should filter out categories with non-string titles', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [
        { id: 1, title: 'Technology' } as unknown as number,
        { id: 2, title: null } as unknown as number,
        { id: 3, title: undefined } as unknown as number,
        { id: 4, title: 123 } as unknown as number,
      ],
      meta: {},
    }

    const result = mapPostToCardData(post)

    expect(result.categories).toEqual(['Technology'])
  })

  it('should handle undefined categories', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: undefined,
      meta: {},
    }

    const result = mapPostToCardData(post)

    expect(result.categories).toBeUndefined()
  })

  it('should handle null categories', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: null as unknown as number[] | undefined,
      meta: {},
    }

    const result = mapPostToCardData(post)

    expect(result.categories).toBeUndefined()
  })

  it('should handle empty categories array', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'test-post',
      title: 'Test Post',
      categories: [],
      meta: {},
    }

    const result = mapPostToCardData(post)

    expect(result.categories).toEqual([])
  })

  it('should handle complete post with all fields', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'complete-post',
      title: 'Complete Test Post',
      categories: [
        { id: 1, title: 'Tech' } as unknown as number,
        { id: 2, title: 'AI' } as unknown as number,
      ],
      meta: {
        description: 'A complete test post with all fields',
        image: {
          url: '/images/complete.jpg',
          alt: 'Complete image',
          width: 1200,
          height: 800,
        },
      },
    }

    const result = mapPostToCardData(post)

    expect(result).toEqual({
      title: 'Complete Test Post',
      href: '/posts/complete-post',
      description: 'A complete test post with all fields',
      image: {
        src: '/images/complete.jpg',
        alt: 'Complete image',
        width: 1200,
        height: 800,
      },
      categories: ['Tech', 'AI'],
    })
  })

  it('should generate correct href from slug', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'my-awesome-post-2024',
      title: 'My Awesome Post',
      categories: [],
      meta: {},
    }

    const result = mapPostToCardData(post)

    expect(result.href).toBe('/posts/my-awesome-post-2024')
  })

  it('should handle special characters in slug', () => {
    const post: Pick<Post, 'slug' | 'title' | 'categories' | 'meta'> = {
      slug: 'post-with-dashes-and_underscores',
      title: 'Post with special chars',
      categories: [],
      meta: {},
    }

    const result = mapPostToCardData(post)

    expect(result.href).toBe('/posts/post-with-dashes-and_underscores')
  })
})
