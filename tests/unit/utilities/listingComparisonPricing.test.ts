import { describe, expect, it } from 'vitest'

import type { Clinic } from '@/payload-types'
import {
  applyPriceWindow,
  compareClinicRows,
  resolveScopedPriceFrom,
} from '@/utilities/listingComparison/serverData/pricing'
import type { ClinicRow } from '@/utilities/listingComparison/serverData/types'

function makeClinic(id: number, name: string, averageRating = 0): Clinic {
  return {
    id,
    name,
    averageRating,
  } as unknown as Clinic
}

describe('listingComparison pricing helpers', () => {
  it('resolves min price from all treatments when no scope is active', () => {
    const prices = new Map<number, number>([
      [10, 7000],
      [11, 5200],
      [12, 6200],
    ])

    expect(resolveScopedPriceFrom(prices, null)).toBe(5200)
  })

  it('resolves min price only from scoped treatments', () => {
    const prices = new Map<number, number>([
      [10, 7000],
      [11, 5200],
      [12, 6200],
    ])

    expect(resolveScopedPriceFrom(prices, new Set([10, 12]))).toBe(6200)
  })

  it('keeps null-price rows only when no explicit price window filter is active', () => {
    const rows: ClinicRow[] = [
      {
        clinic: makeClinic(1, 'Alpha'),
        cityId: 1,
        location: 'Berlin, Germany',
        priceFrom: null,
      },
      {
        clinic: makeClinic(2, 'Bravo'),
        cityId: 1,
        location: 'Berlin, Germany',
        priceFrom: 5000,
      },
    ]

    const noFilter = applyPriceWindow(rows, 0, 10000, 10000)
    expect(noFilter).toHaveLength(2)

    const explicitFilter = applyPriceWindow(rows, 0, 6000, 10000)
    expect(explicitFilter.map((row) => row.clinic.name)).toEqual(['Bravo'])
  })

  it('sorts rows with missing prices after priced rows for price-desc', () => {
    const rows: ClinicRow[] = [
      {
        clinic: makeClinic(1, 'Unknown Price', 4.9),
        cityId: 1,
        location: 'Berlin, Germany',
        priceFrom: null,
      },
      {
        clinic: makeClinic(2, 'Premium Clinic', 4.1),
        cityId: 1,
        location: 'Berlin, Germany',
        priceFrom: 9000,
      },
      {
        clinic: makeClinic(3, 'Standard Clinic', 4.4),
        cityId: 1,
        location: 'Berlin, Germany',
        priceFrom: 5000,
      },
    ]

    const sorted = [...rows].sort((left, right) => compareClinicRows('price-desc', left, right))
    expect(sorted.map((row) => row.clinic.name)).toEqual(['Premium Clinic', 'Standard Clinic', 'Unknown Price'])
  })
})
