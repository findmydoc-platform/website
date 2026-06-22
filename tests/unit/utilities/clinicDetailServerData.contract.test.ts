import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import { getClinicDetailServerData } from '@/utilities/clinicDetail/serverData'

type MockData = {
  clinics: Array<Record<string, unknown>>
  clinictreatments: Array<Record<string, unknown>>
  doctors: Array<Record<string, unknown>>
  doctorspecialties: Array<Record<string, unknown>>
  reviews: Array<Record<string, unknown>>
  accreditation: Array<Record<string, unknown>>
  cities: Array<Record<string, unknown>>
  clinicGalleryEntries: Array<Record<string, unknown>>
}

function lexicalText(value: string) {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: value,
              version: 1,
            },
          ],
          version: 1,
        },
      ],
      version: 1,
    },
  }
}

const mockData: MockData = {
  clinics: [
    {
      id: 1,
      name: 'Berlin Health Clinic',
      slug: 'berlin-health-clinic',
      averageRating: 4.8,
      description: lexicalText('Transparent pediatric care for international families.'),
      thumbnail: {
        id: 100,
        filename: 'clinic-hero.jpg',
        alt: 'Clinic facade',
      },
      galleryEntries: [901, 902],
      coordinates: [52.5168332, 13.4264519],
      address: {
        street: 'Lichtenberger Strasse',
        houseNumber: '24',
        zipCode: 10179,
        city: 501,
        country: 'Germany',
      },
      contact: {
        phoneNumber: '+49 30 123 456',
        email: 'info@example.com',
      },
      accreditations: [801],
      status: 'approved',
      verification: 'gold',
      supportedLanguages: ['english', 'german', 'turkish'],
      updatedAt: '2026-01-10T00:00:00.000Z',
    },
    {
      id: 2,
      name: 'Hidden Draft Clinic',
      slug: 'hidden-draft-clinic',
      averageRating: 4.3,
      description: lexicalText('Draft clinic profile.'),
      thumbnail: null,
      galleryEntries: [],
      coordinates: null,
      address: {
        street: 'Draft Street',
        houseNumber: '1',
        zipCode: 10000,
        city: 501,
        country: 'Germany',
      },
      contact: {
        phoneNumber: '+49 30 000 000',
        email: 'draft@example.com',
      },
      accreditations: [],
      status: 'pending',
      verification: 'silver',
      supportedLanguages: ['english'],
      updatedAt: '2026-01-03T00:00:00.000Z',
    },
  ],
  clinictreatments: [
    {
      id: 201,
      clinic: 1,
      treatment: {
        id: 301,
        name: 'Routine Checkup',
        medicalSpecialty: {
          id: 401,
          name: 'Pediatrics',
        },
      },
      price: 120,
      updatedAt: '2026-01-11T00:00:00.000Z',
    },
    {
      id: 202,
      clinic: 1,
      treatment: {
        id: 302,
        name: 'Developmental Screening',
        medicalSpecialty: {
          id: 402,
          name: 'Diagnostics',
        },
      },
      price: 180,
      updatedAt: '2026-01-09T00:00:00.000Z',
    },
  ],
  doctors: [
    {
      id: 601,
      fullName: 'Dr. Amelia Carter',
      firstName: 'Amelia',
      lastName: 'Carter',
      gender: 'female',
      averageRating: 4.6,
      biography: lexicalText('Focused on pediatric cardiology and clear communication.'),
      profileImage: {
        id: 701,
        filename: 'doctor-amelia.jpg',
        alt: 'Dr. Amelia',
      },
      clinic: 1,
      qualifications: ['MD', 'FAAP'],
      experienceYears: 9,
      languages: ['english', 'spanish'],
      updatedAt: '2026-01-09T00:00:00.000Z',
    },
    {
      id: 602,
      fullName: 'Dr. Jonas Meyer',
      firstName: 'Jonas',
      lastName: 'Meyer',
      gender: 'male',
      averageRating: 4.2,
      biography: lexicalText('General pediatric follow-up and preventive care.'),
      profileImage: null,
      clinic: 1,
      qualifications: ['MD'],
      experienceYears: 6,
      languages: ['english', 'german'],
      updatedAt: '2026-01-08T00:00:00.000Z',
    },
  ],
  doctorspecialties: [
    {
      id: 801,
      doctor: 601,
      medicalSpecialty: {
        id: 901,
        name: 'Pediatric Cardiology',
      },
      specializationLevel: 'expert',
      updatedAt: '2026-01-07T00:00:00.000Z',
    },
  ],
  reviews: [
    {
      id: 1001,
      status: 'approved',
      clinic: 1,
      doctor: 601,
      reviewDate: '2026-01-12T09:15:00.000Z',
      starRating: 5,
      publicAuthorName: 'Maya K.',
      comment: 'Clear explanations and careful aftercare.',
    },
    {
      id: 1002,
      status: 'approved',
      clinic: 1,
      doctor: 601,
      reviewDate: '2026-01-08T12:30:00.000Z',
      starRating: 5,
      comment: 'Clean facility and good communication.',
    },
    {
      id: 1003,
      status: 'pending',
      clinic: 1,
      doctor: 601,
      reviewDate: '2026-01-06T12:30:00.000Z',
      starRating: 1,
      comment: 'Pending review should not appear.',
    },
    {
      id: 1005,
      status: 'rejected',
      clinic: 1,
      doctor: 601,
      reviewDate: '2026-01-04T12:30:00.000Z',
      starRating: 1,
      comment: 'Rejected review should not appear.',
    },
    {
      id: 1004,
      status: 'approved',
      clinic: 1,
      doctor: 602,
      reviewDate: '2026-01-05T10:00:00.000Z',
      starRating: 4,
      comment: 'The treatment plan matched what was discussed.',
    },
  ],
  accreditation: [
    { id: 801, name: 'ISO 9001' },
    { id: 802, name: 'JCI' },
  ],
  cities: [{ id: 501, name: 'Berlin' }],
  clinicGalleryEntries: [
    {
      id: 901,
      clinic: 1,
      title: 'Orthopedic recovery case',
      beforeMedia: {
        id: 1201,
        filename: 'before-1.jpg',
        alt: 'Before recovery',
      },
      afterMedia: {
        id: 1202,
        filename: 'after-1.jpg',
        alt: 'After recovery',
      },
      description: lexicalText('Improved mobility after a guided program.'),
      status: 'published',
    },
    {
      id: 902,
      clinic: 1,
      title: 'Draft case should not appear',
      beforeMedia: {
        id: 1203,
        filename: 'before-2.jpg',
        alt: 'Draft before',
      },
      afterMedia: {
        id: 1204,
        filename: 'after-2.jpg',
        alt: 'Draft after',
      },
      description: lexicalText('Draft description'),
      status: 'draft',
    },
  ],
}

function matchesClause(doc: Record<string, unknown>, clause: Record<string, unknown>): boolean {
  return Object.entries(clause).every(([field, rule]) => {
    if (field === 'and' && Array.isArray(rule)) {
      return rule.every((inner) => matchesClause(doc, inner as Record<string, unknown>))
    }

    if (!rule || typeof rule !== 'object') return true

    const sourceValue = doc[field]
    const relationValue =
      sourceValue && typeof sourceValue === 'object' && 'id' in sourceValue
        ? (sourceValue as { id?: unknown }).id
        : sourceValue

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
    find: async (args: {
      collection: keyof MockData
      page?: number
      limit?: number
      select?: Record<string, unknown>
      sort?: string
      where?: Record<string, unknown>
      overrideAccess?: boolean
      pagination?: boolean
    }) => {
      const source = data[args.collection] ?? []

      const accessFiltered =
        args.collection === 'clinics' && !args.overrideAccess
          ? source.filter((doc) => doc.status === 'approved')
          : source

      const whereFiltered = args.where
        ? accessFiltered.filter((doc) => matchesClause(doc, args.where ?? {}))
        : accessFiltered
      const sorted =
        args.sort === '-reviewDate'
          ? [...whereFiltered].sort((a, b) => String(b.reviewDate ?? '').localeCompare(String(a.reviewDate ?? '')))
          : whereFiltered

      const page = args.page ?? 1
      const limit = args.limit ?? (sorted.length || 1)
      const totalDocs = sorted.length
      const totalPages = Math.max(1, Math.ceil(totalDocs / limit))
      const start = (page - 1) * limit
      const docs = args.pagination === false ? sorted : sorted.slice(start, start + limit)

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

describe('getClinicDetailServerData (contract)', () => {
  it('maps approved clinic data with trust, doctors, gallery and fallback fields', async () => {
    const payload = createMockPayload(mockData)

    const result = await getClinicDetailServerData(payload, 'berlin-health-clinic', {
      draft: false,
    })

    expect(result).not.toBeNull()
    expect(result?.clinicName).toBe('Berlin Health Clinic')
    expect(result?.contactHref).toBe('/contact?clinic=berlin-health-clinic&source=clinic-detail')

    expect(result?.trust.reviewCount).toBe(3)
    expect(result?.trust.ratingValue).toBe(4.8)
    expect(result?.reviews.totalCount).toBe(3)
    expect(result?.reviews.items).toHaveLength(3)
    expect(result?.reviews.items[0]).toMatchObject({
      authorName: 'Maya K.',
      comment: 'Clear explanations and careful aftercare.',
      ratingValue: 5,
    })
    expect(result?.reviews.items[1]).not.toHaveProperty('authorName')
    expect(result?.reviews.items.map((review) => review.comment)).not.toContain('Pending review should not appear.')
    expect(result?.reviews.items.map((review) => review.comment)).not.toContain('Rejected review should not appear.')
    expect(result?.trust.accreditations).toContain('ISO 9001')
    expect(result?.trust.languages).toEqual(expect.arrayContaining(['English', 'German']))
    expect(result?.freshness).toMatchObject({
      updatedAt: '2026-01-12T09:15:00.000Z',
      latestPatientReviewAt: '2026-01-12T09:15:00.000Z',
      verificationTier: 'gold',
    })
    expect(result?.freshness.sourceCollections).toEqual(
      expect.arrayContaining(['clinics', 'clinictreatments', 'reviews']),
    )

    expect(result?.location.fullAddress).toBe('Lichtenberger Strasse 24, 10179 Berlin, Germany')
    expect(result?.location.coordinates).toEqual({
      lat: 52.5168332,
      lng: 13.4264519,
    })

    expect(result?.doctors[0]?.specialty).toBe('Pediatric Cardiology')
    expect(result?.doctors[1]?.specialty).toBe('General Practice')
    expect(result?.doctors[0]?.reviewCount).toBe(2)
    expect(result?.doctors[1]?.image.src).toBe('/images/avatar-doctor-male-placeholder.svg')

    expect(result?.beforeAfterEntries).toHaveLength(1)
    expect(result?.beforeAfterEntries[0]?.title).toBe('Orthopedic recovery case')
  })

  it('rejects approved clinic reviews without an aggregate clinic rating', async () => {
    const dataWithoutAverageRating = {
      ...mockData,
      clinics: mockData.clinics.map((clinic) =>
        clinic.id === 1
          ? {
              ...clinic,
              averageRating: null,
            }
          : clinic,
      ),
    }
    const payload = createMockPayload(dataWithoutAverageRating)

    await expect(
      getClinicDetailServerData(payload, 'berlin-health-clinic', {
        draft: false,
      }),
    ).rejects.toThrow('Clinic 1 has approved reviews but no average rating.')
  })

  it('hides non-approved clinics when draft preview is disabled', async () => {
    const payload = createMockPayload(mockData)

    const result = await getClinicDetailServerData(payload, 'hidden-draft-clinic', {
      draft: false,
    })

    expect(result).toBeNull()
  })

  it('allows non-approved clinics in draft preview mode', async () => {
    const payload = createMockPayload(mockData)

    const result = await getClinicDetailServerData(payload, 'hidden-draft-clinic', {
      draft: true,
    })

    expect(result).not.toBeNull()
    expect(result?.clinicSlug).toBe('hidden-draft-clinic')
  })
})
