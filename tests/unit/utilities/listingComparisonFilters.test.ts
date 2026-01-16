import { describe, expect, it } from 'vitest'

import type { ListingCardData } from '@/components/organisms/Listing'
import { applyListingComparisonFilters, type ListingComparisonFilterState } from '@/utilities/listingComparison/filters'

const baseClinic: ListingCardData = {
  rank: 1,
  name: 'Example Clinic',
  location: 'Berlin, Mitte',
  media: { src: '/images/placeholder-576-968.svg', alt: 'Placeholder' },
  verification: { variant: 'gold' },
  rating: { value: 4.5, count: 10 },
  waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
  tags: ['Hip replacement', 'Modern facilities'],
  priceFrom: { label: 'From', value: 7500, currency: 'EUR' },
  actions: {
    details: { href: '#', label: 'Details' },
    compare: { href: '#', label: 'Compare' },
  },
}

describe('applyListingComparisonFilters', () => {
  it('filters by waitTime using numeric ranges (no string parsing)', () => {
    const clinics: ListingCardData[] = [
      baseClinic,
      {
        ...baseClinic,
        rank: 2,
        name: 'Fast Clinic',
        waitTime: { label: '1-2 weeks', minWeeks: 1, maxWeeks: 2 },
      },
      {
        ...baseClinic,
        rank: 3,
        name: 'Slow Clinic',
        waitTime: { label: '4-6 weeks', minWeeks: 4, maxWeeks: 6 },
      },
    ]

    const filters: ListingComparisonFilterState = {
      cities: [],
      treatments: [],
      priceRange: [0, 20000],
      rating: null,
      waitTimes: [{ minWeeks: 0, maxWeeks: 2 }],
    }

    const result = applyListingComparisonFilters(clinics, filters)
    expect(result.map((c) => c.name)).toEqual(['Fast Clinic'])
  })

  it('treats missing waitTime as non-matching when waitTime filters are active', () => {
    const clinics: ListingCardData[] = [
      baseClinic,
      {
        ...baseClinic,
        rank: 2,
        name: 'Unknown Wait Clinic',
        waitTime: undefined,
      },
    ]

    const filters: ListingComparisonFilterState = {
      cities: [],
      treatments: [],
      priceRange: [0, 20000],
      rating: null,
      waitTimes: [{ minWeeks: 4 }],
    }

    const result = applyListingComparisonFilters(clinics, filters)
    expect(result.map((c) => c.name)).toEqual([])
  })

  it('filters by city substring match (case-insensitive)', () => {
    const clinics: ListingCardData[] = [
      baseClinic,
      {
        ...baseClinic,
        rank: 2,
        name: 'Munich Clinic',
        location: 'Munich, Schwabing',
      },
    ]

    const filters: ListingComparisonFilterState = {
      cities: ['munich'],
      treatments: [],
      priceRange: [0, 20000],
      rating: null,
      waitTimes: [],
    }

    const result = applyListingComparisonFilters(clinics, filters)
    expect(result.map((c) => c.name)).toEqual(['Munich Clinic'])
  })

  it('filters by treatment substring match against tags (case-insensitive)', () => {
    const clinics: ListingCardData[] = [
      baseClinic,
      {
        ...baseClinic,
        rank: 2,
        name: 'Dental Clinic',
        tags: ['Dental implant', 'Recovery suites'],
      },
    ]

    const filters: ListingComparisonFilterState = {
      cities: [],
      treatments: ['dental implant'],
      priceRange: [0, 20000],
      rating: null,
      waitTimes: [],
    }

    const result = applyListingComparisonFilters(clinics, filters)
    expect(result.map((c) => c.name)).toEqual(['Dental Clinic'])
  })
})
