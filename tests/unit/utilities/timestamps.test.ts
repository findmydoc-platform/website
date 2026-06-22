import { describe, expect, it } from 'vitest'

import { findLatestIsoTimestampString, normalizeToIsoTimestampString } from '@/utilities/timestamps'

describe('timestamp utilities', () => {
  it('normalizes valid timestamp strings to ISO strings and ignores invalid values', () => {
    expect(normalizeToIsoTimestampString('2026-01-01T12:30:00.000Z')).toBe('2026-01-01T12:30:00.000Z')
    expect(normalizeToIsoTimestampString('not-a-date')).toBeUndefined()
    expect(normalizeToIsoTimestampString(null)).toBeUndefined()
  })

  it('selects the latest valid timestamp string as an ISO string', () => {
    expect(findLatestIsoTimestampString(['2026-01-01T00:00:00.000Z', 'not-a-date', '2026-01-03T00:00:00.000Z'])).toBe(
      '2026-01-03T00:00:00.000Z',
    )
  })
})
