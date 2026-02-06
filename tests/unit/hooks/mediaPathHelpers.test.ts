import { describe, test, expect } from 'vitest'
import {
  buildNestedFilename,
  buildStoragePath,
  getBaseFilename,
  sanitizePathSegment,
} from '@/collections/common/mediaPathHelpers'

describe('mediaPathHelpers', () => {
  describe('buildNestedFilename', () => {
    test('produces flat filename without slashes when owner is present', () => {
      const result = buildNestedFilename('11', 'abc123', 'photo.jpg')
      expect(result).toBe('11-abc123-photo.jpg')
      expect(result).not.toContain('/')
    })

    test('produces flat filename without slashes when owner is null', () => {
      const result = buildNestedFilename(null, 'abc123', 'photo.jpg')
      expect(result).toBe('abc123-photo.jpg')
      expect(result).not.toContain('/')
    })

    test('produces flat filename without slashes when owner is empty string', () => {
      const result = buildNestedFilename('', 'abc123', 'photo.jpg')
      expect(result).toBe('abc123-photo.jpg')
      expect(result).not.toContain('/')
    })

    test('preserves dashes already in base filename', () => {
      const result = buildNestedFilename('11', 'abc123', 'my-photo-2024.jpg')
      expect(result).toBe('11-abc123-my-photo-2024.jpg')
      expect(result).not.toContain('/')
    })
  })

  describe('buildStoragePath', () => {
    test('uses single slash only after prefix when owner is present', () => {
      const result = buildStoragePath('clinics', '11', 'abc123', 'photo.jpg')
      expect(result).toBe('clinics/11-abc123-photo.jpg')
      // Only one slash — after the prefix
      expect(result.split('/').length).toBe(2)
    })

    test('uses single slash only after prefix when owner is null', () => {
      const result = buildStoragePath('platform', null, 'abc123', 'photo.jpg')
      expect(result).toBe('platform/abc123-photo.jpg')
      expect(result.split('/').length).toBe(2)
    })

    test('uses single slash only after prefix when owner is empty string', () => {
      const result = buildStoragePath('platform', '', 'abc123', 'photo.jpg')
      expect(result).toBe('platform/abc123-photo.jpg')
      expect(result.split('/').length).toBe(2)
    })
  })

  describe('URL safety regression', () => {
    test.each([
      { owner: '11', key: 'abc123', base: 'photo.jpg', label: 'with owner' },
      { owner: null, key: 'abc123', base: 'photo.jpg', label: 'without owner' },
      { owner: '5', key: 'hash1234ab', base: 'hero-banner.png', label: 'with dashed base' },
      { owner: null, key: '0a1b2c3d4e', base: 'avatar.webp', label: 'hash key without owner' },
    ])('filename contains no slashes ($label)', ({ owner, key, base }) => {
      const filename = buildNestedFilename(owner, key, base)
      expect(filename).not.toContain('/')
      expect(filename).not.toContain('\\')
    })

    test('storagePath has exactly one slash separating prefix from flat filename', () => {
      const storagePath = buildStoragePath('platform', null, 'abc123', 'photo.jpg')
      const parts = storagePath.split('/')
      expect(parts).toHaveLength(2)
      expect(parts[0]).toBe('platform')
      expect(parts[1]).not.toContain('/')
    })

    test('filename can be used directly in Payload file URL without encoding', () => {
      const filename = buildNestedFilename('42', 'hashfolder', 'my-image.jpg')
      // URL constructor should not throw — filename is a valid single path segment
      const url = new URL(`/api/platformContentMedia/file/${filename}`, 'http://localhost:3000')
      expect(url.pathname).toBe(`/api/platformContentMedia/file/${filename}`)
    })
  })

  describe('getBaseFilename', () => {
    test('extracts basename from path with slashes', () => {
      expect(getBaseFilename('images/photo.jpg')).toBe('photo.jpg')
    })

    test('returns filename as-is when no slashes', () => {
      expect(getBaseFilename('photo.jpg')).toBe('photo.jpg')
    })

    test('strips leading slashes', () => {
      expect(getBaseFilename('/nested/path/file.png')).toBe('file.png')
    })

    test('returns null for empty/null input', () => {
      expect(getBaseFilename(null)).toBeNull()
      expect(getBaseFilename('')).toBeNull()
      expect(getBaseFilename(undefined)).toBeNull()
    })
  })

  describe('sanitizePathSegment', () => {
    test('replaces slashes with underscores', () => {
      expect(sanitizePathSegment('A/B')).toBe('A_B')
    })

    test('replaces backslashes with underscores', () => {
      expect(sanitizePathSegment('A\\B')).toBe('A_B')
    })

    test('returns null for null/undefined input', () => {
      expect(sanitizePathSegment(null)).toBeNull()
      expect(sanitizePathSegment(undefined)).toBeNull()
    })
  })
})
