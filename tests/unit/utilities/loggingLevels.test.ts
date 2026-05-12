import { describe, expect, it } from 'vitest'
import { isLogLevel, normalizeLogLevel } from '@/utilities/logging/levels'

describe('logging level utilities', () => {
  it('normalizes supported log levels', () => {
    expect(normalizeLogLevel('debug')).toBe('debug')
    expect(normalizeLogLevel(' DEBUG ')).toBe('debug')
    expect(normalizeLogLevel('Warn')).toBe('warn')
  })

  it('returns null for missing or unsupported log levels', () => {
    expect(normalizeLogLevel(undefined)).toBeNull()
    expect(normalizeLogLevel('')).toBeNull()
    expect(normalizeLogLevel('verbose')).toBeNull()
  })

  it('checks exact canonical log level values', () => {
    expect(isLogLevel('debug')).toBe(true)
    expect(isLogLevel('DEBUG')).toBe(false)
    expect(isLogLevel('verbose')).toBe(false)
  })
})
