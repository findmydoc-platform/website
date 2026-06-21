import { describe, expect, it } from 'vitest'

import {
  buildIndexingMetadata,
  LISTING_COMPARISON_CANONICAL_PATH,
  resolveListingComparisonIndexing,
} from '@/features/searchIndexing'

describe('listing comparison search indexing policy', () => {
  it('keeps the base route indexable with a canonical path', () => {
    expect(resolveListingComparisonIndexing()).toEqual({
      canonicalPath: LISTING_COMPARISON_CANONICAL_PATH,
      reason: 'canonical-route',
    })
    expect(resolveListingComparisonIndexing({})).toEqual({
      canonicalPath: LISTING_COMPARISON_CANONICAL_PATH,
      reason: 'canonical-route',
    })
    expect(resolveListingComparisonIndexing(new URLSearchParams())).toEqual({
      canonicalPath: LISTING_COMPARISON_CANONICAL_PATH,
      reason: 'canonical-route',
    })
  })

  it.each([
    { city: 'berlin' },
    { specialty: 'hair-transplant' },
    { treatment: 'fue' },
    { ratingMin: '4' },
    { priceMin: '1000' },
    { priceMax: '5000' },
    { sort: 'price-asc' },
    { page: '2' },
    { service: 'consultation' },
    { location: 'Berlin' },
    { budget: '3000' },
  ])('marks known query variants as noindex, follow for %o', (searchParams) => {
    expect(resolveListingComparisonIndexing(searchParams)).toEqual({
      canonicalPath: LISTING_COMPARISON_CANONICAL_PATH,
      robots: {
        index: false,
        follow: true,
      },
      reason: 'query-variant',
    })
  })

  it('marks unknown query parameters as noindex, follow', () => {
    expect(resolveListingComparisonIndexing({ unknown: 'value' })).toEqual({
      canonicalPath: LISTING_COMPARISON_CANONICAL_PATH,
      robots: {
        index: false,
        follow: true,
      },
      reason: 'query-variant',
    })
  })

  it('treats present empty and repeated query values as query variants', () => {
    expect(resolveListingComparisonIndexing({ specialty: '' })).toMatchObject({
      robots: {
        index: false,
        follow: true,
      },
      reason: 'query-variant',
    })
    expect(resolveListingComparisonIndexing({ city: ['berlin', 'munich'] })).toMatchObject({
      robots: {
        index: false,
        follow: true,
      },
      reason: 'query-variant',
    })
    expect(resolveListingComparisonIndexing(new URLSearchParams('specialty='))).toMatchObject({
      robots: {
        index: false,
        follow: true,
      },
      reason: 'query-variant',
    })
  })

  it('builds Next.js metadata from the indexing policy', () => {
    expect(buildIndexingMetadata(resolveListingComparisonIndexing({}))).toEqual({
      alternates: {
        canonical: LISTING_COMPARISON_CANONICAL_PATH,
      },
    })
    expect(buildIndexingMetadata(resolveListingComparisonIndexing({ city: 'berlin' }))).toEqual({
      alternates: {
        canonical: LISTING_COMPARISON_CANONICAL_PATH,
      },
      robots: {
        index: false,
        follow: true,
      },
    })
  })
})
