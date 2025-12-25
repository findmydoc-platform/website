/**
 * Unit tests for normalizeNavItems utility
 */

import { describe, it, expect } from 'vitest'
import { normalizeNavItems } from '@/utilities/normalizeNavItems'
import type { UiLinkProps } from '@/components/molecules/Link'

describe('normalizeNavItems', () => {
  it('should return empty array when data is null', () => {
    const result = normalizeNavItems(null)
    expect(result).toEqual([])
  })

  it('should return empty array when data is undefined', () => {
    const result = normalizeNavItems(undefined)
    expect(result).toEqual([])
  })

  it('should return empty array when navItems is null', () => {
    const result = normalizeNavItems({ navItems: null })
    expect(result).toEqual([])
  })

  it('should return empty array when navItems is undefined', () => {
    const result = normalizeNavItems({ navItems: undefined })
    expect(result).toEqual([])
  })

  it('should return empty array when navItems is empty', () => {
    const result = normalizeNavItems({ navItems: [] })
    expect(result).toEqual([])
  })

  it('should normalize a custom link', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'custom',
            url: '/about',
            label: 'About Us',
            newTab: false,
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    expect(result).toEqual([
      {
        href: '/about',
        label: 'About Us',
        newTab: false,
        appearance: 'inline',
      } satisfies UiLinkProps,
    ])
  })

  it('should normalize a reference link to pages', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'reference',
            reference: {
              relationTo: 'pages',
              value: {
                slug: 'home',
              },
            },
            label: 'Home',
            newTab: false,
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    expect(result).toEqual([
      {
        href: '/home',
        label: 'Home',
        newTab: false,
        appearance: 'inline',
      },
    ])
  })

  it('should normalize a reference link to posts', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'reference',
            reference: {
              relationTo: 'posts',
              value: {
                slug: 'my-post',
              },
            },
            label: 'Latest Post',
            newTab: false,
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    expect(result).toEqual([
      {
        href: '/posts/my-post',
        label: 'Latest Post',
        newTab: false,
        appearance: 'inline',
      },
    ])
  })

  it('should handle newTab true', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'custom',
            url: 'https://external.com',
            label: 'External Link',
            newTab: true,
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    expect(result[0]?.newTab).toBe(true)
  })

  it('should default newTab to false when missing', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'custom',
            url: '/about',
            label: 'About',
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    expect(result[0]?.newTab).toBe(false)
  })

  it('should handle null label', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'custom',
            url: '/about',
            label: null,
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    expect(result[0]?.label).toBe(null)
  })

  it('should filter out items with no valid href', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'custom',
            url: '/valid',
            label: 'Valid',
          },
        },
        {
          link: {
            type: 'custom',
            url: '',
            label: 'Invalid - Empty URL',
          },
        },
        {
          link: {
            type: 'custom',
            url: null,
            label: 'Invalid - Null URL',
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    expect(result).toHaveLength(1)
    expect(result[0]?.href).toBe('/valid')
  })

  it('should filter out items with non-object link', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'custom',
            url: '/valid',
            label: 'Valid',
          },
        },
        {
          link: 'string-link',
        },
        {
          link: null,
        },
        {
          link: undefined,
        },
      ],
    }

    const result = normalizeNavItems(data)

    expect(result).toHaveLength(1)
    expect(result[0]?.href).toBe('/valid')
  })

  it('should handle multiple valid nav items', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'custom',
            url: '/home',
            label: 'Home',
            newTab: false,
          },
        },
        {
          link: {
            type: 'custom',
            url: '/about',
            label: 'About',
            newTab: false,
          },
        },
        {
          link: {
            type: 'custom',
            url: '/contact',
            label: 'Contact',
            newTab: true,
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    expect(result).toHaveLength(3)
    expect(result[0]?.href).toBe('/home')
    expect(result[1]?.href).toBe('/about')
    expect(result[2]?.href).toBe('/contact')
    expect(result[2]?.newTab).toBe(true)
  })

  it('should handle mixed valid and invalid items', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'custom',
            url: '/valid1',
            label: 'Valid 1',
          },
        },
        {
          link: null,
        },
        {
          link: {
            type: 'custom',
            url: '/valid2',
            label: 'Valid 2',
          },
        },
        {
          link: {
            type: 'custom',
            url: '',
            label: 'Invalid',
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    expect(result).toHaveLength(2)
    expect(result[0]?.href).toBe('/valid1')
    expect(result[1]?.href).toBe('/valid2')
  })

  it('should set appearance to inline for all items', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'custom',
            url: '/link1',
            label: 'Link 1',
          },
        },
        {
          link: {
            type: 'custom',
            url: '/link2',
            label: 'Link 2',
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    expect(result.every((item) => item.appearance === 'inline')).toBe(true)
  })

  it('should handle reference with invalid structure', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'reference',
            reference: {
              // Missing relationTo or value
            },
            label: 'Invalid Reference',
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    expect(result).toEqual([])
  })

  it('should handle reference with missing slug', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'reference',
            reference: {
              relationTo: 'posts',
              value: {
                // Missing slug
              },
            },
            label: 'Invalid Reference',
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    expect(result).toEqual([])
  })

  it('should handle invalid type value', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'invalid-type' as unknown as 'custom' | 'reference',
            url: '/test',
            label: 'Test',
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    // Should still work because it falls back to url
    expect(result).toHaveLength(1)
    expect(result[0]?.href).toBe('/test')
  })

  it('should handle non-string label gracefully', () => {
    const data = {
      navItems: [
        {
          link: {
            type: 'custom',
            url: '/test',
            label: 123 as unknown as string,
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    expect(result[0]?.label).toBe(null)
  })

  it('should handle empty string type and fallback to url', () => {
    const data = {
      navItems: [
        {
          link: {
            type: '' as unknown as 'custom' | 'reference',
            url: '/fallback-url',
            label: 'Test Label',
          },
        },
      ],
    }

    const result = normalizeNavItems(data)

    // Empty string type should still resolve to the URL
    expect(result).toHaveLength(1)
    expect(result[0]?.href).toBe('/fallback-url')
    expect(result[0]?.label).toBe('Test Label')
  })
})
