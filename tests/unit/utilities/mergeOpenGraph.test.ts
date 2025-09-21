/**
 * Unit tests for mergeOpenGraph utility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import type { Metadata } from 'next'

// Mock getServerSideURL
vi.mock('@/utilities/getURL', () => ({
  getServerSideURL: vi.fn(() => 'https://example.com'),
}))

describe('mergeOpenGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return default OpenGraph metadata when no custom data provided', () => {
    const result = mergeOpenGraph()

    expect(result).toEqual({
      type: 'website',
      description: 'An open-source website built with Payload and Next.js.',
      images: [
        {
          url: 'https://example.com/website-template-OG.webp',
        },
      ],
      siteName: 'Payload Website Template',
      title: 'Payload Website Template',
    })
  })

  it('should merge custom OpenGraph data with defaults', () => {
    const customOg: Metadata['openGraph'] = {
      title: 'Custom Page Title',
      description: 'Custom page description',
    }

    const result = mergeOpenGraph(customOg)

    expect(result).toEqual({
      type: 'website',
      description: 'Custom page description',
      images: [
        {
          url: 'https://example.com/website-template-OG.webp',
        },
      ],
      siteName: 'Payload Website Template',
      title: 'Custom Page Title',
    })
  })

  it('should preserve custom images when provided', () => {
    const customOg: Metadata['openGraph'] = {
      title: 'Custom Title',
      images: [
        {
          url: 'https://example.com/custom-image.jpg',
          width: 1200,
          height: 630,
        },
      ],
    }

    const result = mergeOpenGraph(customOg)

    expect(result!.images).toEqual([
      {
        url: 'https://example.com/custom-image.jpg',
        width: 1200,
        height: 630,
      },
    ])
  })

  it('should preserve empty images array when explicitly provided', () => {
    const customOg: Metadata['openGraph'] = {
      title: 'Custom Title',
      images: [], // Empty array is truthy, so it gets preserved
    }

    const result = mergeOpenGraph(customOg)

    expect(result!.images).toEqual([]) // Function preserves the empty array
  })

  it('should use default images when custom images are undefined', () => {
    const customOg: Metadata['openGraph'] = {
      title: 'Custom Title',
      images: undefined,
    }

    const result = mergeOpenGraph(customOg)

    expect(result!.images).toEqual([
      {
        url: 'https://example.com/website-template-OG.webp',
      },
    ])
  })

  it('should handle multiple custom images', () => {
    const customOg: Metadata['openGraph'] = {
      title: 'Custom Title',
      images: [
        {
          url: 'https://example.com/image1.jpg',
          width: 1200,
          height: 630,
        },
        {
          url: 'https://example.com/image2.jpg',
          width: 800,
          height: 400,
        },
      ],
    }

    const result = mergeOpenGraph(customOg)

    expect(result!.images).toHaveLength(2)
    expect(result!.images).toEqual(customOg.images)
  })

  it('should override all default properties when custom values provided', () => {
    const customOg: Metadata['openGraph'] = {
      type: 'article',
      title: 'Article Title',
      description: 'Article description',
      siteName: 'Custom Site Name',
      url: 'https://example.com/article',
      locale: 'en_US',
      images: [
        {
          url: 'https://example.com/article-image.jpg',
        },
      ],
    }

    const result = mergeOpenGraph(customOg)

    expect(result).toEqual({
      type: 'article',
      title: 'Article Title',
      description: 'Article description',
      siteName: 'Custom Site Name',
      url: 'https://example.com/article',
      locale: 'en_US',
      images: [
        {
          url: 'https://example.com/article-image.jpg',
        },
      ],
    })
  })

  it('should handle partial custom data', () => {
    const customOg: Metadata['openGraph'] = {
      title: 'Only Title Changed',
    }

    const result = mergeOpenGraph(customOg)

    expect((result as any).title).toBe('Only Title Changed')
    expect((result as any).type).toBe('website') // Default preserved
    expect((result as any).siteName).toBe('Payload Website Template') // Default preserved
    expect(result!.description).toBe('An open-source website built with Payload and Next.js.') // Default preserved
  })

  it('should handle empty object input', () => {
    const result = mergeOpenGraph({})

    expect(result).toEqual({
      type: 'website',
      description: 'An open-source website built with Payload and Next.js.',
      images: [
        {
          url: 'https://example.com/website-template-OG.webp',
        },
      ],
      siteName: 'Payload Website Template',
      title: 'Payload Website Template',
    })
  })

  it('should handle additional OpenGraph properties', () => {
    const customOg: Metadata['openGraph'] = {
      title: 'Custom Title',
      tags: ['tag1', 'tag2'],
      publishedTime: '2023-01-01T00:00:00.000Z',
      authors: ['Author Name'],
    } as any // Using any to test additional properties

    const result = mergeOpenGraph(customOg)

    const extended = result as any
    expect(extended.title).toBe('Custom Title')
    expect(extended.tags).toEqual(['tag1', 'tag2'])
    expect(extended.publishedTime).toBe('2023-01-01T00:00:00.000Z')
    expect(extended.authors).toEqual(['Author Name'])
  })

  it('should handle null and falsy values appropriately', () => {
    const customOg: Metadata['openGraph'] = {
      title: '',
      description: null as any,
      url: undefined,
    }

    const result = mergeOpenGraph(customOg)

    expect(result!.title).toBe('')
    expect(result!.description).toBe(null)
    expect(result!.url).toBe(undefined)
    // Other defaults should still be present
    expect((result as any).type).toBe('website')
    expect((result as any).siteName).toBe('Payload Website Template')
  })

  it('should handle Twitter-specific OpenGraph properties', () => {
    const customOg: Metadata['openGraph'] = {
      title: 'Twitter Card Title',
      description: 'Twitter card description',
      images: [
        {
          url: 'https://example.com/twitter-image.jpg',
          width: 1200,
          height: 600,
          alt: 'Twitter image alt text',
        },
      ],
    }

    const result = mergeOpenGraph(customOg)

    expect((result!.images as any[])?.[0]).toEqual({
      url: 'https://example.com/twitter-image.jpg',
      width: 1200,
      height: 600,
      alt: 'Twitter image alt text',
    })
  })

  it('should handle complex image objects', () => {
    const customOg: Metadata['openGraph'] = {
      images: [
        {
          url: 'https://example.com/complex-image.jpg',
          secureUrl: 'https://example.com/complex-image.jpg',
          alt: 'Complex image description',
          type: 'image/jpeg',
          width: 1200,
          height: 630,
        },
      ],
    }

    const result = mergeOpenGraph(customOg)

    expect((result!.images as any[])?.[0]).toEqual({
      url: 'https://example.com/complex-image.jpg',
      secureUrl: 'https://example.com/complex-image.jpg',
      alt: 'Complex image description',
      type: 'image/jpeg',
      width: 1200,
      height: 630,
    })
  })
})
