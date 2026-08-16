import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import {
  buildClinicDetailDataCacheTags,
  buildClinicDetailIdentityCacheTags,
  getClinicDetailServerData,
} from '@/utilities/clinicDetail/serverData'

type MockData = {
  clinics: Array<Record<string, unknown>>
  clinicMedia: Array<Record<string, unknown>>
  doctorMedia: Array<Record<string, unknown>>
  clinictreatments: Array<Record<string, unknown>>
  doctors: Array<Record<string, unknown>>
  doctorspecialties: Array<Record<string, unknown>>
  reviews: Array<Record<string, unknown>>
  reviewResponses: Array<Record<string, unknown>>
  accreditation: Array<Record<string, unknown>>
  cities: Array<Record<string, unknown>>
}

type FindCall = {
  collection: string
  overrideAccess?: boolean
  select?: Record<string, unknown>
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
      thumbnail: 100,
      profileGallery: [100, 101],
      galleryEntries: [901, 902],
      coordinates: [13.4264519, 52.5168332],
      address: {
        street: 'Lichtenberger Strasse',
        houseNumber: '24',
        zipCode: '10179',
        city: 501,
        country: { id: 601, name: 'Germany' },
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
        zipCode: '10000',
        city: 501,
        country: { id: 601, name: 'Germany' },
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
  clinicMedia: [
    {
      id: 100,
      filename: 'clinic-hero.jpg',
      alt: 'Clinic facade',
      clinic: 1,
      status: 'published',
    },
    {
      id: 101,
      filename: 'private-draft.jpg',
      alt: 'Private draft',
      clinic: 1,
      status: 'draft',
    },
  ],
  doctorMedia: [
    {
      id: 701,
      filename: 'doctor-amelia.jpg',
      alt: 'Professional portrait of Dr. Amelia Carter',
    },
  ],
  clinictreatments: [
    {
      id: 201,
      active: true,
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
      active: true,
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
    {
      id: 203,
      active: false,
      clinic: 1,
      treatment: {
        id: 303,
        name: 'Hidden Treatment',
        medicalSpecialty: {
          id: 403,
          name: 'Hidden Specialty',
        },
      },
      price: 9999,
      updatedAt: '2026-01-12T00:00:00.000Z',
    },
  ],
  doctors: [
    {
      id: 601,
      active: true,
      fullName: 'Dr. Amelia Carter',
      firstName: 'Amelia',
      lastName: 'Carter',
      gender: 'female',
      averageRating: 4.6,
      biography: 'Focused on pediatric cardiology and clear communication.\n\nSpecial interest in family education.',
      profileImage: 701,
      clinic: 1,
      qualifications: ['MD', 'FAAP'],
      experienceYears: 9,
      languages: ['english', 'spanish'],
      updatedAt: '2026-01-09T00:00:00.000Z',
    },
    {
      id: 602,
      active: true,
      fullName: 'Dr. Jonas Meyer',
      firstName: 'Jonas',
      lastName: 'Meyer',
      gender: 'male',
      averageRating: 4.2,
      biography: null,
      profileImage: null,
      clinic: 1,
      qualifications: ['MD'],
      experienceYears: 6,
      languages: ['english', 'german'],
      updatedAt: '2026-01-08T00:00:00.000Z',
    },
    {
      id: 603,
      active: false,
      fullName: 'Dr. Hidden Profile',
      firstName: 'Hidden',
      lastName: 'Profile',
      gender: 'female',
      averageRating: 4.9,
      biography: 'This inactive profile must not reach public clinic data.',
      profileImage: null,
      clinic: 1,
      qualifications: ['MD'],
      experienceYears: 12,
      languages: ['english'],
      updatedAt: '2026-01-10T00:00:00.000Z',
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
      publicMeasure: 'none',
      withdrawalState: 'active',
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
      publicMeasure: 'none',
      withdrawalState: 'active',
      clinic: 1,
      doctor: 601,
      reviewDate: '2026-01-08T12:30:00.000Z',
      starRating: 5,
      comment: 'Clean facility and good communication.',
    },
    {
      id: 1003,
      status: 'pending',
      publicMeasure: 'none',
      withdrawalState: 'active',
      clinic: 1,
      doctor: 601,
      reviewDate: '2026-01-06T12:30:00.000Z',
      starRating: 1,
      comment: 'Pending review should not appear.',
    },
    {
      id: 1005,
      status: 'rejected',
      publicMeasure: 'none',
      withdrawalState: 'active',
      clinic: 1,
      doctor: 601,
      reviewDate: '2026-01-04T12:30:00.000Z',
      starRating: 1,
      comment: 'Rejected review should not appear.',
    },
    {
      id: 1004,
      status: 'approved',
      publicMeasure: 'none',
      withdrawalState: 'active',
      clinic: 1,
      doctor: 602,
      reviewDate: '2026-01-05T10:00:00.000Z',
      starRating: 4,
      comment: 'The treatment plan matched what was discussed.',
    },
  ],
  reviewResponses: [
    {
      id: 1101,
      review: 1001,
      publishedResponse: {
        body: 'Thank you for the review. We are glad the explanations and aftercare were helpful.',
        approvedAt: '2026-01-13T10:00:00.000Z',
        isBlocked: false,
      },
      updatedAt: '2026-02-01T10:00:00.000Z',
    },
    {
      id: 1102,
      review: 1002,
      publishedResponse: {
        body: 'This blocked response must not reach the public clinic detail.',
        approvedAt: '2026-01-14T10:00:00.000Z',
        isBlocked: true,
      },
      updatedAt: '2026-01-14T10:00:00.000Z',
    },
  ],
  accreditation: [
    { id: 801, name: 'ISO 9001' },
    { id: 802, name: 'JCI' },
  ],
  cities: [{ id: 501, name: 'Berlin' }],
}

function matchesClause(doc: Record<string, unknown>, clause: Record<string, unknown>): boolean {
  return Object.entries(clause).every(([field, rule]) => {
    if (field === 'and' && Array.isArray(rule)) {
      return rule.every((inner) => matchesClause(doc, inner as Record<string, unknown>))
    }

    if (!rule || typeof rule !== 'object') return true

    const sourceValue = field.split('.').reduce<unknown>((value, segment) => {
      if (!value || typeof value !== 'object') return undefined
      return (value as Record<string, unknown>)[segment]
    }, doc)
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

    if ('exists' in rule) {
      return (sourceValue !== null && sourceValue !== undefined) === (rule as { exists?: unknown }).exists
    }

    if ('not_equals' in rule) {
      return relationValue !== (rule as { not_equals?: unknown }).not_equals
    }

    return true
  })
}

function createMockPayload(data: MockData, findCalls: FindCall[] = []): Payload {
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
      findCalls.push({ collection: args.collection, overrideAccess: args.overrideAccess, select: args.select })
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
  it('defines canonical public Data Cache tags for clinic detail reads', () => {
    expect(buildClinicDetailIdentityCacheTags('berlin-health-clinic')).toEqual([
      'slug:clinics:berlin-health-clinic',
      'surface:clinic-detail',
    ])
    expect(buildClinicDetailDataCacheTags({ id: 1, slug: 'berlin-health-clinic' })).toEqual([
      'entity:clinics:1',
      'slug:clinics:berlin-health-clinic',
      'surface:clinic-detail',
      'surface:clinic-detail:1',
      'collection:clinictreatments',
      'collection:doctors',
      'collection:doctorspecialties',
      'collection:reviews',
      'collection:reviewResponses',
      'collection:accreditation',
      'collection:cities',
      'collection:countries',
    ])
  })

  it('maps approved clinic data without loading the disabled gallery', async () => {
    const findCalls: FindCall[] = []
    const payload = createMockPayload(mockData, findCalls)

    const result = await getClinicDetailServerData(payload, 'berlin-health-clinic', {
      draft: false,
    })

    expect(result).not.toBeNull()
    expect(result?.clinicName).toBe('Berlin Health Clinic')
    expect(result?.contactHref).toBe('/contact?clinic=berlin-health-clinic&source=clinic-detail')
    expect(result?.breadcrumbs).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Clinics', href: '/listing-comparison' },
      { label: 'Berlin Health Clinic', href: '/clinics/berlin-health-clinic' },
    ])
    expect(result?.heroImage).toEqual({
      src: '/api/clinicMedia/file/clinic-hero.jpg',
      alt: 'Clinic facade',
    })
    expect(result?.galleryImages).toEqual([
      {
        id: '100',
        src: '/api/clinicMedia/file/clinic-hero.jpg',
        alt: 'Clinic facade',
      },
    ])

    expect(result?.trust.reviewCount).toBe(3)
    expect(result?.trust.ratingValue).toBe(4.8)
    expect(result?.reviews.totalCount).toBe(3)
    expect(result?.reviews.items).toHaveLength(3)
    expect(result?.reviews.items[0]).toMatchObject({
      kind: 'text',
      authorName: 'Maya K.',
      comment: 'Clear explanations and careful aftercare.',
      ratingValue: 5,
      response: {
        body: 'Thank you for the review. We are glad the explanations and aftercare were helpful.',
        clinicName: 'Berlin Health Clinic',
        approvedAt: '2026-01-13T10:00:00.000Z',
      },
    })
    expect(result?.reviews.items[1]).not.toHaveProperty('authorName')
    expect(result?.reviews.items[1]).not.toHaveProperty('response')
    const publicReviewText = result?.reviews.items.flatMap((review) => (review.kind === 'text' ? [review.comment] : []))
    expect(publicReviewText).not.toContain('Pending review should not appear.')
    expect(publicReviewText).not.toContain('Rejected review should not appear.')
    expect(result?.trust.accreditations).toContain('ISO 9001')
    expect(result?.trust.languages).toEqual(expect.arrayContaining(['English', 'German']))
    expect(result?.freshness).toMatchObject({
      updatedAt: '2026-01-13T10:00:00.000Z',
      latestPatientReviewAt: '2026-01-12T09:15:00.000Z',
      verificationTier: 'gold',
    })
    expect(result?.freshness.sourceCollections).toEqual(
      expect.arrayContaining(['clinics', 'clinicMedia', 'clinictreatments', 'reviews', 'reviewResponses']),
    )

    expect(result?.location.fullAddress).toBe('Lichtenberger Strasse 24, 10179 Berlin, Germany')
    expect(result?.location.coordinates).toEqual({
      lat: 52.5168332,
      lng: 13.4264519,
    })

    expect(result?.doctors).toHaveLength(2)
    expect(result?.doctors[0]?.specialty).toBe('Pediatric Cardiology')
    expect(result?.doctors[1]?.specialty).toBe('General Practice')
    expect(result?.doctors[0]?.reviewCount).toBe(2)
    expect(result?.doctors[0]?.description).toBe(
      'Focused on pediatric cardiology and clear communication.\n\nSpecial interest in family education.',
    )
    expect(result?.doctors[1]?.description).toBeUndefined()
    expect(result?.doctors[0]?.image).toEqual({
      src: '/api/doctorMedia/file/doctor-amelia.jpg',
      alt: 'Professional portrait of Dr. Amelia Carter',
    })
    expect(result?.doctors[1]?.image.src).toBe('/images/placeholders/doctor-male-placeholder.webp')
    expect(result?.treatments[0]?.comparisonLink).toEqual({
      href: '/listing-comparison?treatment=301',
      label: 'Compare clinics for Routine Checkup',
    })
    expect(result?.treatments).toHaveLength(2)
    expect(result?.treatments.map((treatment) => treatment.name)).not.toContain('Hidden Treatment')
    expect(result?.treatments[0]?.priceFrom).toBe(120)

    expect(findCalls.some((call) => call.collection === 'clinicGalleryEntries')).toBe(false)
    expect(findCalls.find((call) => call.collection === 'clinics')?.select).toMatchObject({
      galleryEntries: false,
    })
    expect(findCalls.find((call) => call.collection === 'reviews' && call.select?.comment)?.select).toMatchObject({
      status: true,
      withdrawalState: true,
      publicMeasure: true,
      publicComment: true,
      publicNotice: true,
    })
    expect(findCalls.filter((call) => call.collection === 'reviews').every((call) => call.overrideAccess)).toBe(true)
    expect(result).not.toHaveProperty('beforeAfterEntries')
  })

  it('maps every public moderation measure and excludes removed or withdrawn reviews', async () => {
    const moderatedData: MockData = {
      ...mockData,
      reviews: [
        {
          id: 2001,
          status: 'approved',
          publicMeasure: 'none',
          withdrawalState: 'active',
          clinic: 1,
          doctor: 601,
          reviewDate: '2026-02-06T10:00:00.000Z',
          starRating: 5,
          comment: 'Original visible review.',
        },
        {
          id: 2002,
          status: 'approved',
          publicMeasure: 'context',
          publicNotice: 'The clinic supplied additional factual context.',
          withdrawalState: 'active',
          clinic: 1,
          doctor: 601,
          reviewDate: '2026-02-05T10:00:00.000Z',
          starRating: 4,
          comment: 'Context review remains unchanged.',
        },
        {
          id: 2003,
          status: 'approved',
          publicMeasure: 'redaction',
          publicComment: 'Readable review after narrow removal.',
          publicNotice:
            'Parts of this review were removed to protect legal rights or personal data. The remaining text is unchanged.',
          withdrawalState: 'active',
          clinic: 1,
          doctor: 601,
          reviewDate: '2026-02-04T10:00:00.000Z',
          starRating: 3,
          comment: 'Original text containing private data must never render.',
        },
        {
          id: 2004,
          status: 'approved',
          publicMeasure: 'placeholder',
          publicNotice: 'Caller-controlled placeholder must be ignored.',
          withdrawalState: 'active',
          clinic: 1,
          doctor: 602,
          reviewDate: '2026-02-03T10:00:00.000Z',
          starRating: 2,
          comment: 'Placeholder original text must never render.',
        },
        {
          id: 2005,
          status: 'approved',
          publicMeasure: 'removed',
          withdrawalState: 'active',
          clinic: 1,
          doctor: 602,
          reviewDate: '2026-02-02T10:00:00.000Z',
          starRating: 1,
          comment: 'Removed review must not be counted.',
        },
        {
          id: 2006,
          status: 'approved',
          publicMeasure: 'none',
          withdrawalState: 'withdrawn',
          clinic: 1,
          doctor: 602,
          reviewDate: '2026-02-01T10:00:00.000Z',
          starRating: 1,
          comment: 'Withdrawn review must not be counted.',
        },
      ],
      reviewResponses: [2001, 2002, 2003, 2004].map((review, index) => ({
        id: 2100 + index,
        review,
        publishedResponse: {
          body: `Response ${review}`,
          approvedAt: '2026-02-07T10:00:00.000Z',
          isBlocked: false,
        },
      })),
    }

    const result = await getClinicDetailServerData(createMockPayload(moderatedData), 'berlin-health-clinic', {
      draft: false,
    })

    expect(result?.reviews.totalCount).toBe(4)
    expect(result?.reviews.items).toHaveLength(4)
    expect(result?.reviews.items[0]).toMatchObject({ kind: 'text', comment: 'Original visible review.' })
    expect(result?.reviews.items[0]).toHaveProperty('response.body', 'Response 2001')
    expect(result?.reviews.items[1]).toMatchObject({
      kind: 'text',
      comment: 'Context review remains unchanged.',
      notice: 'The clinic supplied additional factual context.',
    })
    expect(result?.reviews.items[1]).toHaveProperty('response.body', 'Response 2002')
    expect(result?.reviews.items[2]).toMatchObject({
      kind: 'text',
      comment: 'Readable review after narrow removal.',
    })
    expect(result?.reviews.items[2]).toHaveProperty('response.body', 'Response 2003')
    expect(result?.reviews.items[3]).toEqual(
      expect.objectContaining({
        kind: 'placeholder',
        notice: 'This review was moderated. Its written content is not publicly available.',
      }),
    )
    expect(result?.reviews.items[3]).not.toHaveProperty('comment')
    expect(result?.reviews.items[3]).not.toHaveProperty('response')
    expect(JSON.stringify(result?.reviews.items)).not.toContain('Original text containing private data')
    expect(JSON.stringify(result?.reviews.items)).not.toContain('Removed review')
    expect(JSON.stringify(result?.reviews.items)).not.toContain('Withdrawn review')
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
