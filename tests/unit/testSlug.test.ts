import { describe, it, expect } from 'vitest'
import { testSlug } from '../fixtures/testSlug'

describe('testSlug', () => {
  it('creates a deterministic slug from filename', () => {
    expect(testSlug('clinic.test.ts')).toBe('test-clinic-test')
  })
  it('applies base prefix when provided', () => {
    expect(testSlug('doctor.spec.ts', 'e2e')).toBe('e2e-test-doctor-spec')
  })
})
