import { describe, expect, it } from 'vitest'

import { SEARCH_ROBOTS_HEADER, SEARCH_ROBOTS_HEADER_VALUE, shouldBlockSearchIndexing } from '@/features/searchIndexing'

describe('searchIndexing feature', () => {
  it('uses a noindex robots response header value', () => {
    expect(SEARCH_ROBOTS_HEADER).toBe('X-Robots-Tag')
    expect(SEARCH_ROBOTS_HEADER_VALUE).toBe('noindex, nofollow, noarchive')
  })

  it('blocks indexing for preview runtime', () => {
    expect(
      shouldBlockSearchIndexing({
        DEPLOYMENT_ENV: undefined,
        NODE_ENV: 'production',
        TEMPORARY_LANDING_MODE_ENABLED: undefined,
        VERCEL_ENV: 'preview',
      }),
    ).toBe(true)
  })

  it('blocks indexing for temporary landing mode outside preview', () => {
    expect(
      shouldBlockSearchIndexing({
        DEPLOYMENT_ENV: undefined,
        NODE_ENV: 'production',
        TEMPORARY_LANDING_MODE_ENABLED: 'true',
        VERCEL_ENV: 'production',
      }),
    ).toBe(true)
  })

  it('does not block indexing for production without temporary landing mode', () => {
    expect(
      shouldBlockSearchIndexing({
        DEPLOYMENT_ENV: undefined,
        NODE_ENV: 'production',
        TEMPORARY_LANDING_MODE_ENABLED: undefined,
        VERCEL_ENV: 'production',
      }),
    ).toBe(false)
  })
})
