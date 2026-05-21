import { describe, expect, it } from 'vitest'

import { normalizeSafeLandingHref } from '@/utilities/landing/safeLandingHref'

describe('safeLandingHref', () => {
  it('accepts allowed hosts regardless of allowedHosts casing', () => {
    const href = 'https://sub.example.com/path'

    expect(
      normalizeSafeLandingHref(href, {
        allowedHosts: ['EXAMPLE.COM'],
      }),
    ).toBe(href)
  })
})
