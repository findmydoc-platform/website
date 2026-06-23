import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import { findPatientFavoriteClinicListItems } from '@/features/favorites/server'

type MockData = {
  favoriteclinics: Array<Record<string, unknown>>
  clinicMedia: Array<Record<string, unknown>>
}

function matchesClause(doc: Record<string, unknown>, clause: Record<string, unknown>): boolean {
  return Object.entries(clause).every(([field, rule]) => {
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

function createMockPayload(data: MockData): Payload {
  return {
    find: async (args: { collection: keyof MockData; where?: Record<string, unknown> }) => {
      const source = data[args.collection] ?? []
      const docs = args.where ? source.filter((doc) => matchesClause(doc, args.where ?? {})) : source

      return {
        docs,
        totalDocs: docs.length,
        limit: docs.length || 1,
        page: 1,
        totalPages: 1,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
        pagingCounter: 1,
      }
    },
  } as unknown as Payload
}

describe('findPatientFavoriteClinicListItems', () => {
  it('resolves clinic thumbnails by relation id', async () => {
    const payload = createMockPayload({
      favoriteclinics: [
        {
          id: 1,
          patient: 99,
          clinic: {
            id: 101,
            name: 'Favorite Clinic',
            slug: 'favorite-clinic',
            averageRating: 4.4,
            verification: 'gold',
            address: {
              city: { name: 'Berlin' },
              country: 'Germany',
            },
            thumbnail: 201,
          },
        },
      ],
      clinicMedia: [
        {
          id: 201,
          filename: 'favorite-clinic.webp',
          alt: 'Favorite clinic image',
        },
      ],
    })

    const items = await findPatientFavoriteClinicListItems({
      payload,
      patientId: 99,
    })

    expect(items).toEqual([
      {
        favoriteId: 1,
        clinicId: 101,
        name: 'Favorite Clinic',
        href: '/clinics/favorite-clinic',
        location: 'Berlin, Germany',
        media: {
          src: '/api/clinicMedia/file/favorite-clinic.webp',
          alt: 'Favorite clinic image',
        },
        verification: {
          variant: 'gold',
        },
        ratingValue: 4.4,
      },
    ])
  })
})
