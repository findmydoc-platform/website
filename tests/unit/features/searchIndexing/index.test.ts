import { describe, expect, it } from 'vitest'

import { PREVIEW_GUARD_LOCK_REQUEST_HEADER } from '@/features/previewGuard'
import {
  SEARCH_ROBOTS_HEADER,
  SEARCH_ROBOTS_HEADER_VALUE,
  shouldBlockSearchIndexing,
  shouldBlockSearchIndexingForRequest,
} from '@/features/searchIndexing'

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
        VERCEL_ENV: 'preview',
      }),
    ).toBe(true)
  })

  it('does not block indexing for production runtime', () => {
    expect(
      shouldBlockSearchIndexing({
        DEPLOYMENT_ENV: undefined,
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).toBe(false)
  })

  it('blocks indexing when the request carries a guard lock header', () => {
    expect(
      shouldBlockSearchIndexingForRequest({
        env: {
          DEPLOYMENT_ENV: undefined,
          NODE_ENV: 'production',
          VERCEL_ENV: 'production',
        },
        headers: new Headers({ [PREVIEW_GUARD_LOCK_REQUEST_HEADER]: '1' }),
      }),
    ).toBe(true)
  })
})
