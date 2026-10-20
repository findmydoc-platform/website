/**
 * Unit tests for formatDateTime utility
 */

import { describe, it, expect, vi } from 'vitest'
import { formatDateTime } from '@/utilities/formatDateTime'

describe('formatDateTime', () => {
  it('should format valid ISO timestamp to MM/DD/YYYY', () => {
    const timestamp = '2023-12-25T10:30:00.000Z'
    const result = formatDateTime(timestamp)
    expect(result).toBe('12/25/2023')
  })

  it('should add leading zeros for single-digit months and days', () => {
    const timestamp = '2023-03-05T08:15:22.456Z'
    const result = formatDateTime(timestamp)
    expect(result).toBe('03/05/2023')
  })

  it('should handle end of year date', () => {
    const timestamp = '2023-12-31T23:59:59.999Z'
    const result = formatDateTime(timestamp)
    expect(result).toBe('12/31/2023')
  })

  it('should handle beginning of year date', () => {
    const timestamp = '2024-01-01T00:00:00.000Z'
    const result = formatDateTime(timestamp)
    expect(result).toBe('01/01/2024')
  })

  it('should use current date when timestamp is empty string', () => {
    // Mock current date to be predictable
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-06-15T12:00:00.000Z'))

    const result = formatDateTime('')
    expect(result).toBe('06/15/2023')

    vi.useRealTimers()
  })

  it('should use current date when timestamp is whitespace-only', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-10-05T10:00:00.000Z'))

    const result = formatDateTime('   ')
    expect(result).toBe('10/05/2023')

    vi.useRealTimers()
  })

  it('should use current date when timestamp is undefined/falsy', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-08-20T14:30:00.000Z'))

    const result = formatDateTime(undefined as unknown as string)
    expect(result).toBe('08/20/2023')

    vi.useRealTimers()
  })

  it('should handle leap year dates', () => {
    const timestamp = '2024-02-29T12:00:00.000Z' // Leap year
    const result = formatDateTime(timestamp)
    expect(result).toBe('02/29/2024')
  })

  it('should handle invalid date strings gracefully', () => {
    const timestamp = 'invalid-date-string'
    const result = formatDateTime(timestamp)
    // Invalid date results in NaN values, which become "NaN/NaN/NaN"
    expect(result).toBe('NaN/NaN/NaN')
  })

  it('should handle various valid date formats', () => {
    // ISO with milliseconds
    expect(formatDateTime('2023-09-15T10:30:45.123Z')).toBe('09/15/2023')

    // ISO without milliseconds
    expect(formatDateTime('2023-09-15T10:30:45Z')).toBe('09/15/2023')

    // ISO with timezone offset
    expect(formatDateTime('2023-09-15T10:30:45+00:00')).toBe('09/15/2023')
  })

  it('should handle current date fallback', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-11-22T09:15:30.000Z'))

    // Test with falsy values that should trigger current date
    expect(formatDateTime('')).toBe('11/22/2023')
    expect(formatDateTime(null as unknown as string)).toBe('11/22/2023')
    expect(formatDateTime(0 as unknown as string)).toBe('11/22/2023')

    vi.useRealTimers()
  })
})
