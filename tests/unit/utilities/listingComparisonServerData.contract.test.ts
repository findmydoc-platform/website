import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import { getListingComparisonServerData } from '@/utilities/listingComparison/serverData'

type MockCollectionData = {
  cities: Array<Record<string, unknown>>
  treatments: Array<Record<string, unknown>>
  'medical-specialties': Array<Record<string, unknown>>
  clinics: Array<Record<string, unknown>>
  clinictreatments: Array<Record<string, unknown>>
  reviews: Array<Record<string, unknown>>
}

const baseData: MockCollectionData = {
  cities: [
    { id: 10, stableId: 'berlin', name: 'Berlin' },
    { id: 11, stableId: 'munich', name: 'Munich' },
  ],
  treatments: [
    { id: 101, stableId: 'nose', name: 'Nose job', medicalSpecialty: 2 },
    { id: 102, stableId: 'breast', name: 'Breast augmentation', medicalSpecialty: 1 },
    { id: 103, stableId: 'implant', name: 'Dental implant', medicalSpecialty: 3 },
  ],
  'medical-specialties': [
    { id: 1, stableId: 'plastic', name: 'Plastic Surgery', parentSpecialty: null },
    { id: 2, stableId: 'facial', name: 'Facial Surgery', parentSpecialty: 1 },
    { id: 3, stableId: 'dental', name: 'Dental', parentSpecialty: null },
  ],
  clinics: [
    {
      id: 201,
      status: 'approved',
      name: 'Alpha Clinic',
      slug: 'alpha-clinic',
      averageRating: 4.7,
      verification: 'gold',
      coordinates: [52.52, 13.405],
      address: {
        city: { id: 10, name: 'Berlin' },
        country: 'Germany',
      },
      thumbnail: null,
      tags: [{ name: 'Premium' }],
    },
    {
      id: 202,
      status: 'approved',
      name: 'Bravo Clinic',
      slug: 'bravo-clinic',
      averageRating: 4.4,
      verification: 'silver',
      coordinates: [48.137, 11.575],
      address: {
        city: { id: 11, name: 'Munich' },
        country: 'Germany',
      },
      thumbnail: null,
      tags: [{ name: 'Modern' }],
    },
    {
      id: 203,
      status: 'approved',
      name: 'Charlie Clinic',
      slug: 'charlie-clinic',
      averageRating: 3.8,
      verification: 'unverified',
      coordinates: null,
      address: {
        city: { id: 10, name: 'Berlin' },
        country: 'Germany',
      },
      thumbnail: null,
      tags: [{ name: 'Dental' }],
    },
    {
      id: 204,
      status: 'pending',
      name: 'Draft Clinic',
      slug: 'draft-clinic',
      averageRating: 5,
      verification: 'bronze',
      coordinates: null,
      address: {
        city: { id: 10, name: 'Berlin' },
        country: 'Germany',
      },
      thumbnail: null,
      tags: [{ name: 'Draft' }],
    },
  ],
  clinictreatments: [
    { id: 301, clinic: 201, treatment: 101, price: 5000 },
    { id: 302, clinic: 201, treatment: 102, price: 7000 },
    { id: 303, clinic: 202, treatment: 101, price: 5200 },
    { id: 304, clinic: 202, treatment: 102, price: 6000 },
    { id: 305, clinic: 203, treatment: 103, price: 2000 },
  ],
  reviews: [
    { id: 401, status: 'approved', clinic: 201 },
    { id: 402, status: 'approved', clinic: 201 },
    { id: 403, status: 'pending', clinic: 201 },
    { id: 404, status: 'approved', clinic: 202 },
    { id: 405, status: 'approved', clinic: 203 },
  ],
}

function matchesClause(doc: Record<string, unknown>, clause: Record<string, unknown>): boolean {
  return Object.entries(clause).every(([field, rule]) => {
    if (field === 'and' && Array.isArray(rule)) {
      return rule.every((inner) => matchesClause(doc, inner as Record<string, unknown>))
    }

    if (!rule || typeof rule !== 'object') return true

    const value = doc[field]
    const relationValue = value && typeof value === 'object' && 'id' in value ? (value as { id?: unknown }).id : value

    if ('equals' in rule) {
      return relationValue === (rule as { equals?: unknown }).equals
    }

    if ('in' in rule) {
      const options = (rule as { in?: unknown }).in
      return Array.isArray(options) ? options.includes(relationValue) : false
    }

    return true
  })
}

function createMockPayload(data: MockCollectionData): Payload {
  return {
    find: async (args: {
      collection: keyof MockCollectionData
      page?: number
      limit?: number
      where?: Record<string, unknown>
    }) => {
      const source = data[args.collection] ?? []
      const filtered = args.where ? source.filter((doc) => matchesClause(doc, args.where ?? {})) : source

      const page = args.page ?? 1
      const limit = args.limit ?? (filtered.length || 1)
      const totalDocs = filtered.length
      const totalPages = Math.max(1, Math.ceil(totalDocs / limit))
      const start = (page - 1) * limit
      const docs = filtered.slice(start, start + limit)

      return {
        docs,
        totalDocs,
        limit,
        page,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
        pagingCounter: start + 1,
      }
    },
  } as unknown as Payload
}

describe('getListingComparisonServerData (contract)', () => {
  it('computes specialty-scoped prices, global pagination totals, and clinic review counts', async () => {
    const payload = createMockPayload(baseData)

    const result = await getListingComparisonServerData(payload, {
      specialty: '1',
      sort: 'rank',
    })

    expect(result.priceBounds).toEqual({ min: 0, max: 5200 })
    expect(result.pagination.totalResults).toBe(2)
    expect(result.pagination.totalAvailableResults).toBe(3)
    expect(result.pagination.totalPages).toBe(1)
    expect(result.results.map((clinic) => clinic.name)).toEqual(['Alpha Clinic', 'Bravo Clinic'])
    expect(result.results[0]?.rating.count).toBe(2)

    const cityLabels = result.filterOptions.cities.map((option) => option.label)
    expect(cityLabels).toContain('Berlin (1)')
    expect(cityLabels).toContain('Munich (1)')
  })

  it('keeps selected zero-count facets while counting each facet against the proper dimension', async () => {
    const payload = createMockPayload(baseData)

    const result = await getListingComparisonServerData(payload, {
      city: '10',
      treatment: '102',
      priceMax: '6500',
    })

    expect(result.pagination.totalResults).toBe(0)
    expect(result.pagination.totalAvailableResults).toBe(3)

    const cityLabels = result.filterOptions.cities.map((option) => option.label)
    expect(cityLabels).toContain('Berlin (0)')
    expect(cityLabels).toContain('Munich (1)')

    const treatmentLabels = result.filterOptions.treatments.map((option) => option.label)
    expect(treatmentLabels).toContain('Breast augmentation (0)')
    expect(treatmentLabels).toContain('Nose job (1)')
  })
})
