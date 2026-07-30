import { describe, expect, it } from 'vitest'

import { normalizeClinicPostalCode, validateClinicPostalCode } from '@/collections/clinics/postalCode'

describe('clinic postal code contract', () => {
  it.each([
    ['  10115  ', '10115'],
    [' SW1A 1AA ', 'SW1A 1AA'],
    [' 75008-PARIS ', '75008-PARIS'],
  ])('trims only the exterior whitespace of %s', (input, expected) => {
    expect(normalizeClinicPostalCode(input)).toBe(expected)
  })

  it.each(['10115', 'SW1A 1AA', '75008-PARIS', 'Łódź 90-001'])('accepts %s', async (value) => {
    expect(await validateClinicPostalCode(value, {} as never)).toBe(true)
  })

  it.each(['10115/2', '10115.', '10115_2'])('rejects %s', async (value) => {
    expect(await validateClinicPostalCode(value, {} as never)).not.toBe(true)
  })
})
