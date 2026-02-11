import type { Payload } from 'payload'

import type { City, Clinic, Clinictreatment, MedicalSpecialty, Review, Treatment } from '@/payload-types'
import { chunkArray, extractRelationId } from './relations'

const CLINIC_CHUNK_SIZE = 200
const QUERY_PAGE_SIZE = 500

/**
 * Repository helpers for the listing-comparison pipeline.
 * They encapsulate all paginated/chunked Payload queries used by the server assembler.
 */
export async function findAllCities(payload: Payload): Promise<City[]> {
  let page = 1
  const docs: City[] = []

  while (true) {
    const result = await payload.find({
      collection: 'cities',
      depth: 0,
      page,
      limit: QUERY_PAGE_SIZE,
      pagination: true,
      overrideAccess: false,
      select: {
        id: true,
        stableId: true,
        name: true,
      },
    })

    docs.push(...(result.docs as City[]))
    if (!result.hasNextPage) break
    page += 1
  }

  return docs
}

export async function findAllTreatments(payload: Payload): Promise<Treatment[]> {
  let page = 1
  const docs: Treatment[] = []

  while (true) {
    const result = await payload.find({
      collection: 'treatments',
      depth: 0,
      page,
      limit: QUERY_PAGE_SIZE,
      pagination: true,
      overrideAccess: false,
      select: {
        id: true,
        stableId: true,
        name: true,
        medicalSpecialty: true,
      },
    })

    docs.push(...(result.docs as Treatment[]))
    if (!result.hasNextPage) break
    page += 1
  }

  return docs
}

export async function findAllSpecialties(payload: Payload): Promise<MedicalSpecialty[]> {
  let page = 1
  const docs: MedicalSpecialty[] = []

  while (true) {
    const result = await payload.find({
      collection: 'medical-specialties',
      depth: 0,
      page,
      limit: QUERY_PAGE_SIZE,
      pagination: true,
      overrideAccess: false,
      select: {
        id: true,
        stableId: true,
        name: true,
        parentSpecialty: true,
      },
    })

    docs.push(...(result.docs as MedicalSpecialty[]))
    if (!result.hasNextPage) break
    page += 1
  }

  return docs
}

export async function findAllApprovedClinics(payload: Payload): Promise<Clinic[]> {
  let page = 1
  const docs: Clinic[] = []

  while (true) {
    const result = await payload.find({
      collection: 'clinics',
      depth: 2,
      page,
      limit: QUERY_PAGE_SIZE,
      pagination: true,
      overrideAccess: false,
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

    docs.push(...(result.docs as Clinic[]))
    if (!result.hasNextPage) break
    page += 1
  }

  return docs
}

export async function findClinicTreatmentsForClinics(
  payload: Payload,
  clinicIds: number[],
): Promise<Clinictreatment[]> {
  if (clinicIds.length === 0) return []

  const allDocs: Clinictreatment[] = []
  const chunks = chunkArray(clinicIds, CLINIC_CHUNK_SIZE)

  for (const chunk of chunks) {
    let page = 1

    while (true) {
      const result = await payload.find({
        collection: 'clinictreatments',
        depth: 0,
        page,
        limit: QUERY_PAGE_SIZE,
        pagination: true,
        overrideAccess: false,
        where: {
          clinic: {
            in: chunk,
          },
        },
        select: {
          id: true,
          clinic: true,
          treatment: true,
          price: true,
        },
      })

      allDocs.push(...(result.docs as Clinictreatment[]))
      if (!result.hasNextPage) break
      page += 1
    }
  }

  return allDocs
}

export async function countApprovedReviewsByClinic(
  payload: Payload,
  clinicIds: number[],
): Promise<Map<number, number>> {
  const counts = new Map<number, number>()
  if (clinicIds.length === 0) return counts

  const chunks = chunkArray(clinicIds, CLINIC_CHUNK_SIZE)

  for (const chunk of chunks) {
    let page = 1

    while (true) {
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
                in: chunk,
              },
            },
          ],
        },
        select: {
          clinic: true,
        },
      })

      const docs = result.docs as Review[]
      docs.forEach((review) => {
        const clinicId = extractRelationId(review.clinic)
        if (!clinicId) return
        const current = counts.get(clinicId) ?? 0
        counts.set(clinicId, current + 1)
      })

      if (!result.hasNextPage) break
      page += 1
    }
  }

  return counts
}
