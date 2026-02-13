import type { Payload } from 'payload'

import type { City, Clinic, Clinictreatment, MedicalSpecialty, Review, Treatment } from '@/payload-types'
import { chunkArray, extractRelationId } from './relations'

const CLINIC_CHUNK_SIZE = 200
const QUERY_PAGE_SIZE = 500

type PagedDocs<T> = {
  docs: T[]
  hasNextPage: boolean
}

async function collectAllPages<T>(fetchPage: (page: number) => Promise<PagedDocs<T>>): Promise<T[]> {
  const allDocs: T[] = []
  let page = 1

  while (true) {
    const result = await fetchPage(page)
    allDocs.push(...result.docs)
    if (!result.hasNextPage) break
    page += 1
  }

  return allDocs
}

/**
 * Repository helpers for the listing-comparison pipeline.
 * They encapsulate all paginated/chunked Payload queries used by the server assembler.
 */
export async function findAllCities(payload: Payload): Promise<City[]> {
  return collectAllPages<City>(async (page) => {
    const result = await payload.find({
      collection: 'cities',
      depth: 0,
      page,
      limit: QUERY_PAGE_SIZE,
      pagination: true,
      overrideAccess: false,
      select: {
        id: true,
        name: true,
      },
    })

    return {
      docs: result.docs as City[],
      hasNextPage: result.hasNextPage,
    }
  })
}

export async function findAllTreatments(payload: Payload): Promise<Treatment[]> {
  return collectAllPages<Treatment>(async (page) => {
    const result = await payload.find({
      collection: 'treatments',
      depth: 0,
      page,
      limit: QUERY_PAGE_SIZE,
      pagination: true,
      overrideAccess: false,
      select: {
        id: true,
        name: true,
        medicalSpecialty: true,
      },
    })

    return {
      docs: result.docs as Treatment[],
      hasNextPage: result.hasNextPage,
    }
  })
}

export async function findAllSpecialties(payload: Payload): Promise<MedicalSpecialty[]> {
  return collectAllPages<MedicalSpecialty>(async (page) => {
    const result = await payload.find({
      collection: 'medical-specialties',
      depth: 0,
      page,
      limit: QUERY_PAGE_SIZE,
      pagination: true,
      overrideAccess: false,
      select: {
        id: true,
        name: true,
        parentSpecialty: true,
      },
    })

    return {
      docs: result.docs as MedicalSpecialty[],
      hasNextPage: result.hasNextPage,
    }
  })
}

export async function findAllApprovedClinics(payload: Payload): Promise<Clinic[]> {
  return collectAllPages<Clinic>(async (page) => {
    const result = await payload.find({
      collection: 'clinics',
      depth: 2,
      page,
      limit: QUERY_PAGE_SIZE,
      pagination: true,
      overrideAccess: true,
      populate: {
        clinicMedia: {
          url: true,
          alt: true,
          filename: true,
        },
        tags: {
          name: true,
        },
      },
      where: {
        status: {
          equals: 'approved',
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        averageRating: true,
        verification: true,
        coordinates: true,
        address: {
          city: true,
          country: true,
        },
        thumbnail: true,
        tags: true,
      },
    })

    return {
      docs: result.docs as Clinic[],
      hasNextPage: result.hasNextPage,
    }
  })
}

export async function findClinicTreatmentsForClinics(
  payload: Payload,
  clinicIds: number[],
): Promise<Clinictreatment[]> {
  if (clinicIds.length === 0) return []

  const allDocs: Clinictreatment[] = []
  const clinicIdChunks = chunkArray(clinicIds, CLINIC_CHUNK_SIZE)

  for (const clinicIdChunk of clinicIdChunks) {
    const chunkDocs = await collectAllPages<Clinictreatment>(async (page) => {
      const result = await payload.find({
        collection: 'clinictreatments',
        depth: 0,
        page,
        limit: QUERY_PAGE_SIZE,
        pagination: true,
        overrideAccess: false,
        where: {
          clinic: {
            in: clinicIdChunk,
          },
        },
        select: {
          id: true,
          clinic: true,
          treatment: true,
          price: true,
        },
      })

      return {
        docs: result.docs as Clinictreatment[],
        hasNextPage: result.hasNextPage,
      }
    })

    allDocs.push(...chunkDocs)
  }

  return allDocs
}

export async function countApprovedReviewsByClinic(
  payload: Payload,
  clinicIds: number[],
): Promise<Map<number, number>> {
  const counts = new Map<number, number>()
  if (clinicIds.length === 0) return counts

  const clinicIdChunks = chunkArray(clinicIds, CLINIC_CHUNK_SIZE)

  for (const clinicIdChunk of clinicIdChunks) {
    const chunkReviews = await collectAllPages<Review>(async (page) => {
      const result = await payload.find({
        collection: 'reviews',
        depth: 0,
        page,
        limit: QUERY_PAGE_SIZE,
        pagination: true,
        overrideAccess: false,
        where: {
          and: [
            {
              status: {
                equals: 'approved',
              },
            },
            {
              clinic: {
                in: clinicIdChunk,
              },
            },
          ],
        },
        select: {
          clinic: true,
        },
      })

      return {
        docs: result.docs as Review[],
        hasNextPage: result.hasNextPage,
      }
    })

    chunkReviews.forEach((review) => {
      const clinicId = extractRelationId(review.clinic)
      if (!clinicId) return
      const current = counts.get(clinicId) ?? 0
      counts.set(clinicId, current + 1)
    })
  }

  return counts
}
