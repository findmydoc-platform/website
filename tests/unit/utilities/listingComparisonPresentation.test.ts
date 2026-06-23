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

  it('prefers an available listing-card image size over the original upload URL', () => {
    const clinic = buildClinic({
      id: 20,
      name: 'Bravo Sized Clinic',
      thumbnail: {
        id: 120,
        url: '/api/clinicMedia/file/20-aabbccdde0-bravo-sized-clinic.webp',
        filename: '20-aabbccdde0-bravo-sized-clinic.webp',
        alt: 'Bravo sized image',
        sizes: {
          medium: {
            url: '/api/clinicMedia/file/bravo-sized-clinic-900x600.webp',
            width: 900,
            height: 600,
          },
        },
      },
    })

    const result = mapListingCardResults([buildRow(clinic)], new Map(), {
      availableClinicMediaFiles: new Set(['bravo-sized-clinic-900x600.webp']),
    })

    expect(result[0]?.media.src).toBe('/api/clinicMedia/file/bravo-sized-clinic-900x600.webp')
    expect(result[0]?.media.alt).toBe('Bravo sized image')
  })

  it('falls back from a missing listing-card image size to an available original upload URL', () => {
    const clinic = buildClinic({
      id: 23,
      name: 'Bravo Original Clinic',
      thumbnail: {
        id: 123,
        url: '/api/clinicMedia/file/23-aabbccdde0-bravo-original-clinic.webp',
        filename: '23-aabbccdde0-bravo-original-clinic.webp',
        alt: 'Bravo original image',
        sizes: {
          medium: {
            url: '/api/clinicMedia/file/bravo-original-clinic-900x600.webp',
            width: 900,
            height: 600,
          },
        },
      },
    })

    const result = mapListingCardResults([buildRow(clinic)], new Map(), {
      availableClinicMediaFiles: new Set(['23-aabbccdde0-bravo-original-clinic.webp']),
    })

    expect(result[0]?.media.src).toBe('/api/clinicMedia/file/23-aabbccdde0-bravo-original-clinic.webp')
    expect(result[0]?.media.alt).toBe('Bravo original image')
  })

  it('uses a filename-derived upload URL when no local availability set exists', () => {
    const clinic = buildClinic({
      id: 21,
      name: 'Bravo Preview Clinic',
      thumbnail: {
        id: 121,
        url: null,
        filename: 'preview-file.jpg',
        alt: 'Bravo preview image',
      },
    })

    const result = mapListingCardResults([buildRow(clinic)], new Map())

    expect(result[0]?.media.src).toBe('/api/clinicMedia/file/preview-file.jpg')
    expect(result[0]?.media.alt).toBe('Bravo preview image')
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

    expect(result[0]?.media.src).toBe('/images/placeholders/clinic-placeholder.webp')
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

    expect(result[0]?.media.src).toBe('/images/placeholders/clinic-placeholder.webp')
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
