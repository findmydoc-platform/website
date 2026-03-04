import { describe, expect, it } from 'vitest'

import {
  buildListingComparisonHref,
  buildListingComparisonSearchParams,
  LISTING_COMPARISON_PRICE_MAX_DEFAULT,
  LISTING_COMPARISON_PRICE_MIN_DEFAULT,
  parseListingComparisonQueryState,
} from '@/utilities/listingComparison/queryState'

describe('parseListingComparisonQueryState', () => {
  it('returns defaults for empty params', () => {
    const parsed = parseListingComparisonQueryState({})

    expect(parsed.state).toEqual({
      page: 1,
      sort: 'rank',
      cities: [],
      treatments: [],
      specialties: [],
      ratingMin: null,
      priceMin: LISTING_COMPARISON_PRICE_MIN_DEFAULT,
      priceMax: LISTING_COMPARISON_PRICE_MAX_DEFAULT,
    })
    expect(parsed.legacy).toEqual({
      service: null,
      location: null,
      budget: null,
    })
  })

  it('normalizes invalid values and parses comma-separated multi-select params', () => {
    const parsed = parseListingComparisonQueryState({
      page: '-3',
      sort: 'not-valid',
      city: 'berlin,munich,berlin',
      treatment: 'hair,eyes',
      specialty: 'plastic-surgery',
      ratingMin: '7.4',
      priceMin: '1500',
      priceMax: '1000',
      service: 'blepharoplasty',
      location: 'Berlin',
      budget: '3000',
    })

    expect(parsed.state.page).toBe(1)
    expect(parsed.state.sort).toBe('rank')
    expect(parsed.state.cities).toEqual(['berlin', 'munich'])
    expect(parsed.state.treatments).toEqual(['hair', 'eyes'])
    expect(parsed.state.specialties).toEqual(['plastic-surgery'])
    expect(parsed.state.ratingMin).toBe(5)
    expect(parsed.state.priceMin).toBe(1500)
    expect(parsed.state.priceMax).toBe(1500)
    expect(parsed.legacy).toEqual({
      service: 'blepharoplasty',
      location: 'Berlin',
      budget: 3000,
    })
  })

  it('normalizes repeated-key array params and deduplicates values', () => {
    const parsed = parseListingComparisonQueryState({
      city: ['berlin', 'munich'],
      treatment: ['hair', 'eyes'],
      specialty: ['plastic-surgery', 'facial-surgery', 'plastic-surgery'],
    })

    expect(parsed.state.cities).toEqual(['berlin', 'munich'])
    expect(parsed.state.treatments).toEqual(['hair', 'eyes'])
    expect(parsed.state.specialties).toEqual(['plastic-surgery', 'facial-surgery'])
  })

  it('uses legacy budget as fallback max price', () => {
    const parsed = parseListingComparisonQueryState({
      budget: '4200',
    })

    expect(parsed.state.priceMax).toBe(4200)
  })
})

describe('buildListingComparisonSearchParams', () => {
  it('omits default values and serializes arrays as comma-separated lists', () => {
    const params = buildListingComparisonSearchParams({
      page: 1,
      sort: 'rank',
      cities: ['city-a'],
      treatments: ['treatment-a', 'treatment-b'],
      specialties: ['specialty-a'],
      ratingMin: null,
      priceMin: LISTING_COMPARISON_PRICE_MIN_DEFAULT,
      priceMax: LISTING_COMPARISON_PRICE_MAX_DEFAULT,
    })

    expect(params.get('city')).toBe('city-a')
    expect(params.get('treatment')).toBe('treatment-a,treatment-b')
    expect(params.get('specialty')).toBe('specialty-a')
    expect(params.get('page')).toBeNull()
    expect(params.get('sort')).toBeNull()
    expect(params.get('ratingMin')).toBeNull()
    expect(params.get('priceMin')).toBeNull()
    expect(params.get('priceMax')).toBeNull()
  })

  it('omits priceMax when it matches runtime defaults', () => {
    const params = buildListingComparisonSearchParams(
      {
        page: 1,
        sort: 'rank',
        cities: [],
        treatments: [],
        specialties: [],
        ratingMin: null,
        priceMin: LISTING_COMPARISON_PRICE_MIN_DEFAULT,
        priceMax: 8500,
      },
      { priceMax: 8500 },
    )

    expect(params.get('priceMax')).toBeNull()
  })

  it('includes non-default values in generated href', () => {
    const href = buildListingComparisonHref({
      page: 2,
      sort: 'price-asc',
      cities: ['city-a'],
      treatments: [],
      specialties: [],
      ratingMin: 4.5,
      priceMin: 100,
      priceMax: 5000,
    })

    expect(href).toContain('/listing-comparison?')
    expect(href).toContain('page=2')
    expect(href).toContain('sort=price-asc')
    expect(href).toContain('city=city-a')
    expect(href).toContain('ratingMin=4.5')
    expect(href).toContain('priceMin=100')
    expect(href).toContain('priceMax=5000')
  })

  it('respects runtime defaults when building href', () => {
    const href = buildListingComparisonHref(
      {
        page: 1,
        sort: 'rank',
        cities: [],
        treatments: [],
        specialties: [],
        ratingMin: null,
        priceMin: LISTING_COMPARISON_PRICE_MIN_DEFAULT,
        priceMax: 7200,
      },
      { priceMax: 7200 },
    )

    expect(href).toBe('/listing-comparison')
  })
})
