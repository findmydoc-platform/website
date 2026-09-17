import { describe, expect, it } from 'vitest'
import baselineCountries from '@/endpoints/seed/data/baseline/countries.json'
import demoClinics from '@/endpoints/seed/data/demo/clinics.json'

describe('Türkiye reporting seed integrity', () => {
  it('relates every demo clinic to the Türkiye country used by Europe/Istanbul reporting', () => {
    const türkiye = baselineCountries.find((country) => country.isoCode === 'TR')

    expect(türkiye).toMatchObject({ name: 'Türkiye', stableId: expect.any(String) })
    expect(demoClinics).not.toHaveLength(0)
    expect(demoClinics.every((clinic) => clinic.countryStableId === türkiye?.stableId)).toBe(true)
  })
})
