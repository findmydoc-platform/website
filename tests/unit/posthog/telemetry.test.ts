import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  extractPostHogDistinctIdFromCookieHeader,
  sanitizePostHogRequestUrl,
  sendRequestErrorToPostHog,
} from '../../../src/posthog/telemetry'

const sendExceptionToPostHog = vi.hoisted(() => vi.fn())

vi.mock('../../../src/posthog/server', () => ({
  sendExceptionToPostHog,
}))

describe('posthog telemetry helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extractPostHogDistinctIdFromCookieHeader returns undefined for null/empty', () => {
    expect(extractPostHogDistinctIdFromCookieHeader(null)).toBeUndefined()
    expect(extractPostHogDistinctIdFromCookieHeader('')).toBeUndefined()
  })

  it('extractPostHogDistinctIdFromCookieHeader extracts distinct_id when present', () => {
    const value = encodeURIComponent(JSON.stringify({ distinct_id: 'user-123' }))
    const header = `a=b; ph_phc_abc_posthog=${value}; c=d`

    expect(extractPostHogDistinctIdFromCookieHeader(header)).toBe('user-123')
  })

  it('extractPostHogDistinctIdFromCookieHeader returns undefined for invalid JSON', () => {
    const header = `ph_phc_abc_posthog=%7Bnot-json%7D`
    expect(extractPostHogDistinctIdFromCookieHeader(header)).toBeUndefined()
  })

  it('sanitizePostHogRequestUrl strips origin, query, and hash from absolute URLs', () => {
    expect(
      sanitizePostHogRequestUrl('https://findmydoc.eu/auth/callback?code=secret&email=patient@example.com#done'),
    ).toBe('/auth/callback')
  })

  it('sanitizePostHogRequestUrl strips query and hash from relative URLs', () => {
    expect(sanitizePostHogRequestUrl('/auth/password/reset/complete?error=secret#done')).toBe(
      '/auth/password/reset/complete',
    )
  })

  it('sendRequestErrorToPostHog sends sanitized server-scoped exception metadata', async () => {
    await sendRequestErrorToPostHog(new Error('boom'), {
      headers: {
        cookie: `ph_phc_abc_posthog=${encodeURIComponent(JSON.stringify({ distinct_id: 'attacker-controlled' }))}`,
        'user-agent': 'vitest',
      },
      method: 'GET',
      url: 'https://findmydoc.eu/auth/callback?code=secret&email=patient@example.com#done',
    })

    expect(sendExceptionToPostHog).toHaveBeenCalledWith(expect.any(Error), {
      distinctId: 'server',
      method: 'GET',
      timestamp: expect.any(String),
      url: '/auth/callback',
      userAgent: 'vitest',
    })
  })
})
