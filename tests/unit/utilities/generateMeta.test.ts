/**
 * Unit tests for generateMeta utility
 */

import { describe, it, expect, vi } from 'vitest'
import { generateMeta } from '@/utilities/generateMeta'
import type { Page, Post, PlatformContentMedia } from '@/payload-types'

// Mock the dependencies
vi.mock('@/utilities/mergeOpenGraph', () => ({
  mergeOpenGraph: vi.fn((og) => ({
    type: 'website',
    title: og?.title || 'Default Title',
    description: og?.description || 'Default Description',
    images: og?.images || [{ url: 'https://example.com/default.jpg' }],
    ...og,
  })),
}))

vi.mock('@/utilities/getURL', () => ({
  getServerSideURL: vi.fn(() => 'https://example.com'),
}))

describe('generateMeta', () => {
  it('should generate metadata for page with complete meta fields', async () => {
    const pageDoc: Partial<Page> = {
      meta: {
        title: 'About Us',
        description: 'Learn more about our company and mission',
        image: {
          id: 123,
          url: '/uploads/about-hero.jpg',
          sizes: {
            og: {
              url: '/uploads/about-hero-og.jpg',
              width: 1200,
              height: 630,
            },
          },
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
  } as PlatformContentMedia,
      },
      slug: 'about-us',
    }

    const result = await generateMeta({ doc: pageDoc })

    expect(result.title).toBe('About Us | Payload Website Template')
    expect(result.description).toBe('Learn more about our company and mission')
    expect(result.openGraph).toBeDefined()
  })

  it('should generate metadata for post with image', async () => {
    const postDoc: Partial<Post> = {
      meta: {
        title: 'How to Build Amazing Websites',
        description: 'A comprehensive guide to modern web development',
        image: {
          id: 456,
          url: '/uploads/post-image.jpg',
          sizes: {
            og: {
              url: '/uploads/post-image-og.jpg',
              width: 1200,
              height: 630,
            },
          },
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
  } as PlatformContentMedia,
      },
      slug: 'how-to-build-amazing-websites',
    }

    const result = await generateMeta({ doc: postDoc })

    expect(result.title).toBe('How to Build Amazing Websites | Payload Website Template')
    expect(result.description).toBe('A comprehensive guide to modern web development')
  })

  it('should generate default metadata when document is null', async () => {
    const result = await generateMeta({ doc: null })

    expect(result.title).toBe('Payload Website Template')
    expect(result.description).toBeUndefined()
    expect(result.openGraph).toBeDefined()
  })

  it('should handle document without meta fields', async () => {
    const pageDoc: Partial<Page> = {
      slug: 'no-meta-page',
      // No meta field
    }

    const result = await generateMeta({ doc: pageDoc })

    expect(result.title).toBe('Payload Website Template')
    expect(result.description).toBeUndefined()
  })

  it('should handle document with empty meta fields', async () => {
    const pageDoc: Partial<Page> = {
      meta: {
        // Empty meta object
      },
      slug: 'empty-meta',
    }

    const result = await generateMeta({ doc: pageDoc })

    expect(result.title).toBe('Payload Website Template')
    expect(result.description).toBeUndefined()
  })

  it('should handle document with meta title but no description', async () => {
    const pageDoc: Partial<Page> = {
      meta: {
        title: 'Page Title Only',
      },
      slug: 'title-only',
    }

    const result = await generateMeta({ doc: pageDoc })

    expect(result.title).toBe('Page Title Only | Payload Website Template')
    expect(result.description).toBeUndefined()
  })

  it('should handle document with meta description but no title', async () => {
    const pageDoc: Partial<Page> = {
      meta: {
        description: 'Description without title',
      },
      slug: 'description-only',
    }

    const result = await generateMeta({ doc: pageDoc })

    expect(result.title).toBe('Payload Website Template')
    expect(result.description).toBe('Description without title')
  })

  it('should handle image without OG size', async () => {
    const pageDoc: Partial<Page> = {
      meta: {
        title: 'Image Test',
        image: {
          id: 789,
          url: '/uploads/regular-image.jpg',
          // No sizes.og
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
  } as PlatformContentMedia,
      },
    }

    const result = await generateMeta({ doc: pageDoc })

    expect(result.title).toBe('Image Test | Payload Website Template')
    // Should use regular URL when no OG size available
    expect(result.openGraph).toBeDefined()
  })

  it('should handle numeric image ID instead of Media object', async () => {
    const pageDoc: Partial<Page> = {
      meta: {
        title: 'Numeric Image ID',
        image: 123 as any, // Numeric ID instead of Media object
      },
    }

    const result = await generateMeta({ doc: pageDoc })

    expect(result.title).toBe('Numeric Image ID | Payload Website Template')
    expect(result.openGraph).toBeDefined()
  })

  it('should handle array slug for nested pages', async () => {
    const pageDoc: Partial<Page> = {
      meta: {
        title: 'Nested Page',
        description: 'A page in a nested structure',
      },
      slug: ['parent', 'child'] as any,
    }

    const result = await generateMeta({ doc: pageDoc })

    expect(result.title).toBe('Nested Page | Payload Website Template')
    expect(result.description).toBe('A page in a nested structure')
    expect(result.openGraph).toBeDefined()
  })

  it('should handle very long titles', async () => {
    const longTitle =
      'This is a very long page title that might be used in some real-world scenarios where content creators write detailed titles'

    const pageDoc: Partial<Page> = {
      meta: {
        title: longTitle,
        description: 'Test description',
      },
    }

    const result = await generateMeta({ doc: pageDoc })

    expect(result.title).toBe(`${longTitle} | Payload Website Template`)
    expect(result.description).toBe('Test description')
  })

  it('should handle special characters in meta fields', async () => {
    const pageDoc: Partial<Page> = {
      meta: {
        title: 'Special & Characters "Test"',
        description: 'Description with <html> & special chars',
      },
    }

    const result = await generateMeta({ doc: pageDoc })

    expect(result.title).toBe('Special & Characters "Test" | Payload Website Template')
    expect(result.description).toBe('Description with <html> & special chars')
  })
})
