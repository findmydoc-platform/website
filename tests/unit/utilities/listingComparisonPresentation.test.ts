import { describe, expect, it } from 'vitest'

import type { Clinic } from '@/payload-types'
import { mapListingCardResults } from '@/utilities/listingComparison/serverData/presentation'
import type { ClinicRow } from '@/utilities/listingComparison/serverData/types'

function buildClinic({ id, name, thumbnail }: { id: number; name: string; thumbnail: unknown }): Clinic {
  return {
    id,
    name,
    slug: `${name.toLowerCase().replace(/\s+/g, '-')}-${id}`,
    averageRating: 4.2,
    verification: 'unverified',
    tags: [],
    thumbnail,
  } as unknown as Clinic
}

function buildRow(clinic: Clinic): ClinicRow {
  return {
    clinic,
    cityId: null,
    location: 'Istanbul, Turkey',
    priceFrom: 1200,
  }
}

describe('mapListingCardResults media resolution', () => {
  it('uses direct relation URL when media provides one', () => {
    const clinic = buildClinic({
      id: 1,
      name: 'Alpha Clinic',
      thumbnail: {
        id: 101,
        url: '/images/clinic/from-relation.jpg',
        filename: 'from-filename.jpg',
        alt: 'Alpha image',
      },
    })

    const result = mapListingCardResults([buildRow(clinic)], new Map())

    expect(result[0]?.media.src).toBe('/images/clinic/from-relation.jpg')
    expect(result[0]?.media.alt).toBe('Alpha image')
    expect(result[0]?.actions.details.href).toBe('/clinics/alpha-clinic-1')
  })

  it('uses an available filename-derived upload URL without per-card filesystem checks', () => {
    const clinic = buildClinic({
      id: 2,
      name: 'Bravo Clinic',
      thumbnail: {
        id: 102,
        url: null,
        filename: 'from-filename.jpg',
        alt: 'Bravo image',
      },
    })

    const result = mapListingCardResults([buildRow(clinic)], new Map(), {
      availableClinicMediaFiles: new Set(['from-filename.jpg']),
    })

    expect(result[0]?.media.src).toBe('/api/clinicMedia/file/from-filename.jpg')
    expect(result[0]?.media.alt).toBe('Bravo image')
  })

  it('falls back to the placeholder when a filename-derived upload is unavailable', () => {
    const clinic = buildClinic({
      id: 22,
      name: 'Bravo Missing Clinic',
      thumbnail: {
        id: 122,
        url: null,
        filename: 'missing.jpg',
        alt: 'Bravo missing image',
      },
    })

    const result = mapListingCardResults([buildRow(clinic)], new Map(), {
      availableClinicMediaFiles: new Set(['other.jpg']),
    })

    expect(result[0]?.media.src).toBe('/images/placeholder-576-968.svg')
    expect(result[0]?.media.alt).toBe('Bravo missing image')
  })

  it('falls back to placeholder when URL and filename are both missing', () => {
    const clinic = buildClinic({
      id: 3,
      name: 'Charlie Clinic',
      thumbnail: {
        id: 103,
        url: null,
        alt: 'No file available',
      },
    })

    const result = mapListingCardResults([buildRow(clinic)], new Map())

    expect(result[0]?.media.src).toBe('/images/placeholder-576-968.svg')
  })

  it('preserves full query content on clinic media URLs', () => {
    const clinic = buildClinic({
      id: 4,
      name: 'Delta Clinic',
      thumbnail: {
        id: 104,
        url: '/api/clinicMedia/file/image.jpg?note=first?second&lang=de',
        alt: 'Delta image',
      },
    })

    const result = mapListingCardResults([buildRow(clinic)], new Map(), {
      availableClinicMediaFiles: new Set(['image.jpg']),
    })

    expect(result[0]?.media.src).toBe('/api/clinicMedia/file/image.jpg?note=first?second&lang=de')
  })
})
