/**
 * Unit tests for getMediaUrl utility
 */

import { describe, it, expect } from 'vitest'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import type { Media } from '@/payload-types'

describe('getMediaUrl', () => {
  it('should return URL from Media object with url property', () => {
    const mediaObject: Media = {
      id: 123,
      url: '/uploads/image.jpg',
      filename: 'image.jpg',
      mimeType: 'image/jpeg',
      filesize: 1024,
      width: 800,
      height: 600,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    }

    expect(getMediaUrl(mediaObject)).toBe('/uploads/image.jpg')
  })

  it('should return null for Media object without url property', () => {
    const mediaObject = {
      id: 123,
      filename: 'image.jpg',
      // url property is missing
    } as unknown as Media

    expect(getMediaUrl(mediaObject)).toBe(null)
  })

  it('should return null for Media object with empty url', () => {
    const mediaObject: Media = {
      id: 123,
      url: '', // empty url
      filename: 'image.jpg',
      mimeType: 'image/jpeg',
      filesize: 1024,
      width: 800,
      height: 600,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    }

    expect(getMediaUrl(mediaObject)).toBe(null)
  })

  it('should return null for numeric ID', () => {
    expect(getMediaUrl(123)).toBe(null)
  })

  it('should return null for null input', () => {
    expect(getMediaUrl(null)).toBe(null)
  })

  it('should return null for undefined input', () => {
    expect(getMediaUrl(undefined)).toBe(null)
  })

  it('should handle Media object with additional properties', () => {
    const mediaObject: Media = {
      id: 456,
      url: '/uploads/document.pdf',
      filename: 'document.pdf',
      mimeType: 'application/pdf',
      filesize: 2048,
      width: null,
      height: null,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      alt: 'Document alt text',
      sizes: {
        thumbnail: {
          width: 150,
          height: 150,
          url: '/uploads/document-thumbnail.jpg',
        },
      },
    } as any

    expect(getMediaUrl(mediaObject)).toBe('/uploads/document.pdf')
  })

  it('should return null for object without url but with other properties', () => {
    const fakeMediaObject = {
      id: 789,
      filename: 'test.jpg',
      mimeType: 'image/jpeg',
      // No url property
    }

    expect(getMediaUrl(fakeMediaObject as any)).toBe(null)
  })

  it('should handle object that has url property with falsy value', () => {
    const mediaWithFalsyUrl = {
      id: 999,
      url: null, // null url
      filename: 'test.jpg',
    }

    expect(getMediaUrl(mediaWithFalsyUrl as any)).toBe(null)
  })

  it('should validate typeof object check', () => {
    // Test the type checking logic
    expect(getMediaUrl('string' as any)).toBe(null)
    expect(getMediaUrl(true as any)).toBe(null)
    expect(getMediaUrl([] as any)).toBe(null)
    expect(getMediaUrl({} as any)).toBe(null) // Empty object without url
  })
})
