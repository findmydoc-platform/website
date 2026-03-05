import { describe, expect, it } from 'vitest'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'

describe('emailNormalization', () => {
  it('normalizes by trimming and lowercasing', () => {
    expect(normalizeEmail('  USER@Example.COM  ')).toBe('user@example.com')
  })

  it('returns empty string for non-string values', () => {
    expect(normalizeEmail(undefined)).toBe('')
    expect(normalizeEmail(null)).toBe('')
  })

  it('validates normalized emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('invalid-email')).toBe(false)
  })
})
