/**
 * Unit tests for generatePreviewPath utility
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import type { PayloadRequest } from 'payload'

describe('generatePreviewPath', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should generate preview path for posts collection', () => {
    process.env.PREVIEW_SECRET = 'test-secret-123'

    const result = generatePreviewPath({
      collection: 'posts',
      slug: 'hello-world',
      req: {} as unknown as PayloadRequest, // Mock request object (not used in function)
    })

    // Should generate URL with correct parameters
    expect(result).toBe(
      '/next/preview?slug=hello-world&collection=posts&path=%2Fposts%2Fhello-world&previewSecret=test-secret-123',
    )
  })

  it('should generate preview path for pages collection', () => {
    process.env.PREVIEW_SECRET = 'my-preview-secret'

    const result = generatePreviewPath({
      collection: 'pages',
      slug: 'about-us',
      req: {} as unknown as PayloadRequest,
    })

    // Pages collection has empty prefix, so path should be just /about-us
    expect(result).toBe('/next/preview?slug=about-us&collection=pages&path=%2Fabout-us&previewSecret=my-preview-secret')
  })

  it('should handle empty preview secret', () => {
    delete process.env.PREVIEW_SECRET

    const result = generatePreviewPath({
      collection: 'posts',
      slug: 'test-post',
      req: {} as unknown as PayloadRequest,
    })

    // Should use empty string when no preview secret
    expect(result).toBe('/next/preview?slug=test-post&collection=posts&path=%2Fposts%2Ftest-post&previewSecret=')
  })

  it('should handle slugs with special characters', () => {
    process.env.PREVIEW_SECRET = 'secret'

    const result = generatePreviewPath({
      collection: 'posts',
      slug: 'hello-world-2023!',
      req: {} as unknown as PayloadRequest,
    })

    // URLSearchParams properly encodes special characters - ! becomes %21
    expect(result).toContain('slug=hello-world-2023%21')
    expect(result).toContain('path=%2Fposts%2Fhello-world-2023%21')
  })

  it('should handle different collection types', () => {
    process.env.PREVIEW_SECRET = 'test'

    const postsResult = generatePreviewPath({
      collection: 'posts',
      slug: 'test',
      req: {} as unknown as PayloadRequest,
    })

    const pagesResult = generatePreviewPath({
      collection: 'pages',
      slug: 'test',
      req: {} as unknown as PayloadRequest,
    })

    // Posts should have /posts prefix
    expect(postsResult).toContain('path=%2Fposts%2Ftest')

    // Pages should have no prefix (empty string in collectionPrefixMap)
    expect(pagesResult).toContain('path=%2Ftest')
  })

  it('should handle long slugs', () => {
    process.env.PREVIEW_SECRET = 'secret'

    const longSlug = 'this-is-a-very-long-slug-that-might-be-used-in-some-real-world-scenarios'
    const result = generatePreviewPath({
      collection: 'posts',
      slug: longSlug,
      req: {} as unknown as PayloadRequest,
    })

    expect(result).toContain(`slug=${longSlug}`)
    expect(result).toContain(`path=%2Fposts%2F${longSlug}`)
  })

  it('should handle slugs with spaces (though they should be slugified)', () => {
    process.env.PREVIEW_SECRET = 'secret'

    const result = generatePreviewPath({
      collection: 'posts',
      slug: 'hello world',
      req: {} as unknown as PayloadRequest,
    })

    // URLSearchParams handles spaces
    expect(result).toContain('slug=hello+world')
    expect(result).toContain('path=%2Fposts%2Fhello+world')
  })

  it('should handle empty slug', () => {
    process.env.PREVIEW_SECRET = 'secret'

    const result = generatePreviewPath({
      collection: 'posts',
      slug: '',
      req: {} as unknown as PayloadRequest,
    })

    expect(result).toContain('slug=')
    expect(result).toContain('path=%2Fposts%2F')
  })

  it('should maintain consistent parameter order', () => {
    process.env.PREVIEW_SECRET = 'secret'

    const result = generatePreviewPath({
      collection: 'posts',
      slug: 'test',
      req: {} as unknown as PayloadRequest,
    })

    // Should have specific parameter order: slug, collection, path, previewSecret
    const url = new URL(`http://example.com${result}`)
    const params = Array.from(url.searchParams.keys())

    expect(params).toEqual(['slug', 'collection', 'path', 'previewSecret'])
  })

  it('should handle numeric-like slugs', () => {
    process.env.PREVIEW_SECRET = 'secret'

    const result = generatePreviewPath({
      collection: 'posts',
      slug: '12345',
      req: {} as unknown as PayloadRequest,
    })

    expect(result).toContain('slug=12345')
    expect(result).toContain('path=%2Fposts%2F12345')
  })

  it('should properly encode URL parameters', () => {
    process.env.PREVIEW_SECRET = 'secret/with/slashes'

    const result = generatePreviewPath({
      collection: 'posts',
      slug: 'test&param=value',
      req: {} as unknown as PayloadRequest,
    })

    // URLSearchParams should encode special characters
    expect(result).toContain('slug=test%26param%3Dvalue')
    expect(result).toContain('previewSecret=secret%2Fwith%2Fslashes')
  })

  it('should generate correct base path', () => {
    process.env.PREVIEW_SECRET = 'secret'

    const result = generatePreviewPath({
      collection: 'posts',
      slug: 'test',
      req: {} as unknown as PayloadRequest,
    })

    // Should always start with /next/preview
    expect(result).toMatch(/^\/next\/preview\?/)
  })
})
