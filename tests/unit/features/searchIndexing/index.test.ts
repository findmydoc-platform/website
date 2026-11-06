import { describe, expect, it } from 'vitest'

import { PREVIEW_GUARD_LOCK_REQUEST_HEADER } from '@/features/previewGuard'
import { HOLDING_VIEW_REQUEST_HEADER } from '@/features/temporaryLandingMode'
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
        DEPLOYMENT_ENVIRONMENT: undefined,
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
      }),
    ).toBe(true)
  })

  it('does not block indexing for production runtime', () => {
    expect(
      shouldBlockSearchIndexing({
        DEPLOYMENT_ENVIRONMENT: undefined,
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
      }),
    ).toBe(false)
  })

  it.each([
    ['a Preview Guard lock', { [PREVIEW_GUARD_LOCK_REQUEST_HEADER]: '1' }],
    ['a standalone Holding view', { [HOLDING_VIEW_REQUEST_HEADER]: 'standalone' }],
  ] as const)('blocks indexing when the request carries %s', (_view, requestHeaders) => {
    expect(
      shouldBlockSearchIndexingForRequest({
        env: {
          DEPLOYMENT_ENVIRONMENT: undefined,
          NODE_ENV: 'production',
          VERCEL_ENV: 'production',
        },
        headers: new Headers(requestHeaders),
      }),
    ).toBe(true)
  })
})
