import { describe, expect, it } from 'vitest'

import { buildListingComparisonResolvedDataCacheKey } from '@/utilities/listingComparison/serverData'

const collidingServiceFacets = {
  cityDocs: [],
  specialtyDocs: [
    { id: 2, name: 'Facial Surgery', parentSpecialty: null },
    { id: 3, name: 'Dental', parentSpecialty: null },
  ],
  treatmentDocs: [
    { id: 2, name: 'Dental collision treatment', medicalSpecialty: 3 },
    { id: 101, name: 'Nose job', medicalSpecialty: 2 },
  ],
} as unknown as Parameters<typeof buildListingComparisonResolvedDataCacheKey>[1]

describe('listing comparison legacy service resolution', () => {
  it('resolves a colliding numeric legacy service ID to specialty only', () => {
    const legacyKey = buildListingComparisonResolvedDataCacheKey({ service: '2' }, collidingServiceFacets)

    expect(legacyKey).toBe(buildListingComparisonResolvedDataCacheKey({ specialty: '2' }, collidingServiceFacets))
    expect(legacyKey).not.toBe(buildListingComparisonResolvedDataCacheKey({ treatment: '2' }, collidingServiceFacets))
  })

  it('keeps legacy treatment-only values working', () => {
    expect(buildListingComparisonResolvedDataCacheKey({ service: '101' }, collidingServiceFacets)).toBe(
      buildListingComparisonResolvedDataCacheKey({ treatment: '101' }, collidingServiceFacets),
    )
  })

  it('does not combine a legacy service fallback with an explicit canonical filter', () => {
    expect(
      buildListingComparisonResolvedDataCacheKey(
        {
          service: '2',
          treatment: '2',
        },
        collidingServiceFacets,
      ),
    ).toBe(buildListingComparisonResolvedDataCacheKey({ treatment: '2' }, collidingServiceFacets))
  })
})
