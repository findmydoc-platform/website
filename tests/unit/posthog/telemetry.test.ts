import { describe, it, expect } from 'vitest'
import { extractPostHogDistinctIdFromCookieHeader } from '../../../src/posthog/telemetry'

describe('posthog telemetry helpers', () => {
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
})
