import { describe, expect, it } from 'vitest'

import { buildLlmsTxt } from '@/features/publicDiscovery/llmsTxt'
import {
  PUBLIC_CANONICAL_SITE_URL,
  PUBLIC_DISCOVERY_AGENT_CONTEXT_PATHS,
  PUBLIC_DISCOVERY_SITEMAP_PATHS,
  PUBLIC_DISCOVERY_SURFACE_PATHS,
  toPublicCanonicalUrl,
} from '@/features/publicDiscovery/site'

const extractAbsoluteUrls = (content: string): string[] => {
  return [...content.matchAll(/https?:\/\/[^\s)]+/gu)].map((match) => match[0])
}

const expectIncludesAll = (values: readonly string[], expectedValues: readonly string[]) => {
  for (const expectedValue of expectedValues) {
    expect(values.includes(expectedValue), expectedValue).toBe(true)
  }
}

describe('public discovery contract', () => {
  it('keeps the production canonical host separate from runtime URL resolution', () => {
    expect(PUBLIC_CANONICAL_SITE_URL).toBe('https://findmydoc.eu')
    expect(toPublicCanonicalUrl('/')).toBe('https://findmydoc.eu/')
    expect(toPublicCanonicalUrl('/contact')).toBe('https://findmydoc.eu/contact')
    expect(() => toPublicCanonicalUrl('https://preview.findmydoc.eu/contact')).toThrow(
      'Public canonical paths must be root-relative',
    )
  })

  it('tracks the public discovery surfaces that need contract coverage', () => {
    expectIncludesAll(PUBLIC_DISCOVERY_SURFACE_PATHS, [
      '/robots.txt',
      '/sitemap.xml',
      '/pages-sitemap.xml',
      '/posts-sitemap.xml',
      '/llms.txt',
      '/.well-known/llms.txt',
    ])
    expect(PUBLIC_DISCOVERY_SITEMAP_PATHS).toEqual(['/pages-sitemap.xml', '/posts-sitemap.xml'])
    expect(PUBLIC_DISCOVERY_AGENT_CONTEXT_PATHS).toEqual(['/llms.txt', '/.well-known/llms.txt'])
  })

  it('renders llms.txt with canonical public URLs only', () => {
    const urls = extractAbsoluteUrls(buildLlmsTxt())

    expectIncludesAll(urls, [
      'https://findmydoc.eu/',
      'https://findmydoc.eu/listing-comparison',
      'https://findmydoc.eu/pages-sitemap.xml',
      'https://findmydoc.eu/posts-sitemap.xml',
      'https://findmydoc.eu/contact',
    ])
    expect(urls.every((url) => url.startsWith(PUBLIC_CANONICAL_SITE_URL))).toBe(true)
    expect(urls.some((url) => url.includes('preview.findmydoc.eu'))).toBe(false)
    expect(urls.some((url) => url.includes('/admin'))).toBe(false)
    expect(urls.some((url) => url.includes('/api'))).toBe(false)
  })
})
