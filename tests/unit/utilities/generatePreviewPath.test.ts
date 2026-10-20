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

  it('should append the requested non-default locale to the preview path', () => {
    process.env.PREVIEW_SECRET = 'locale-secret'

    const result = generatePreviewPath({
      collection: 'posts',
      slug: 'hello-world',
      req: { locale: 'de' } as unknown as PayloadRequest,
    })

    expect(result).toBe(
      '/next/preview?slug=hello-world&collection=posts&path=%2Fposts%2Fhello-world%3Flocale%3Dde&previewSecret=locale-secret',
    )
  })

  it('should ignore the default locale in preview paths', () => {
    process.env.PREVIEW_SECRET = 'default-locale-secret'

    const result = generatePreviewPath({
      collection: 'pages',
      slug: 'about-us',
      req: { locale: 'en' } as unknown as PayloadRequest,
    })

    expect(result).toBe(
      '/next/preview?slug=about-us&collection=pages&path=%2Fabout-us&previewSecret=default-locale-secret',
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
})
