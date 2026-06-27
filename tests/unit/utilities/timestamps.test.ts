import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  findLatestIsoTimestampString,
  getCurrentIsoTimestampString,
  normalizeToIsoTimestampString,
  parseTimestampStringToMs,
} from '@/utilities/timestamps'

describe('timestamp utilities', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates the current time as an ISO timestamp string', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T12:30:00.000Z'))

    expect(getCurrentIsoTimestampString()).toBe('2026-01-01T12:30:00.000Z')
  })

  it('parses valid timestamp strings to milliseconds and ignores invalid inputs', () => {
    expect(parseTimestampStringToMs('2026-01-01T12:30:00.000Z')).toBe(1767270600000)
    expect(parseTimestampStringToMs(' 2026-01-01T12:30:00+00:00 ')).toBe(1767270600000)
    expect(parseTimestampStringToMs('')).toBeUndefined()
    expect(parseTimestampStringToMs('not-a-date')).toBeUndefined()
    expect(parseTimestampStringToMs(new Date('2026-01-01T12:30:00.000Z'))).toBeUndefined()
  })

  it('normalizes valid timestamp strings to ISO strings and ignores invalid values', () => {
    expect(normalizeToIsoTimestampString('2026-01-01T12:30:00.000Z')).toBe('2026-01-01T12:30:00.000Z')
    expect(normalizeToIsoTimestampString('2026-01-01T13:30:00+01:00')).toBe('2026-01-01T12:30:00.000Z')
    expect(normalizeToIsoTimestampString('not-a-date')).toBeUndefined()
    expect(normalizeToIsoTimestampString(null)).toBeUndefined()
  })

  it('selects the latest valid timestamp string as an ISO string', () => {
    expect(findLatestIsoTimestampString(['2026-01-01T00:00:00.000Z', 'not-a-date', '2026-01-03T00:00:00.000Z'])).toBe(
      '2026-01-03T00:00:00.000Z',
    )
  })
})
