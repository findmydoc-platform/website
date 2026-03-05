import type { Payload } from 'payload'

import type {
  Accreditation,
  City,
  Clinic,
  ClinicGalleryEntry,
  Clinictreatment,
  Doctor,
  Doctorspecialty,
  Review,
} from '@/payload-types'

const QUERY_PAGE_SIZE = 500
const QUERY_CHUNK_SIZE = 200

type PagedDocs<T> = {
  docs: T[]
  hasNextPage: boolean
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return []

  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function extractRelationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const relation = value as { id?: unknown }
    return extractRelationId(relation.id)
  }

  return null
}

async function collectAllPages<T>(fetchPage: (page: number) => Promise<PagedDocs<T>>): Promise<T[]> {
  const docs: T[] = []
  let page = 1

  while (true) {
    const result = await fetchPage(page)
    docs.push(...result.docs)

    if (!result.hasNextPage) break
    page += 1
  }

  return docs
}

export async function findClinicBySlug(payload: Payload, slug: string, draft: boolean): Promise<Clinic | null> {
  const result = await payload.find({
    collection: 'clinics',
    depth: 2,
    limit: 1,
    pagination: false,
    overrideAccess: draft,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  const clinic = result.docs[0] as Clinic | undefined
  if (!clinic) return null

  if (!draft && clinic.status !== 'approved') {
    return null
  }

  return clinic
}

export async function findClinicTreatmentsByClinicId(payload: Payload, clinicId: number): Promise<Clinictreatment[]> {
  return collectAllPages<Clinictreatment>(async (page) => {
    const result = await payload.find({
      collection: 'clinictreatments',
      depth: 2,
      page,
      limit: QUERY_PAGE_SIZE,
      pagination: true,
      overrideAccess: false,
      where: {
        clinic: {
          equals: clinicId,
        },
      },
      select: {
        id: true,
        price: true,
        clinic: true,
        treatment: true,
      },
    })

    return {
      docs: result.docs as Clinictreatment[],
      hasNextPage: result.hasNextPage,
    }
  })
}

export async function findDoctorsByClinicId(payload: Payload, clinicId: number): Promise<Doctor[]> {
  return collectAllPages<Doctor>(async (page) => {
    const result = await payload.find({
      collection: 'doctors',
      depth: 1,
      page,
      limit: QUERY_PAGE_SIZE,
      pagination: true,
      overrideAccess: false,
      where: {
        clinic: {
          equals: clinicId,
        },
      },
      select: {
        id: true,
        fullName: true,
        firstName: true,
        lastName: true,
        gender: true,
        averageRating: true,
        biography: true,
        profileImage: true,
        clinic: true,
        qualifications: true,
        experienceYears: true,
        languages: true,
      },
    })

    return {
      docs: result.docs as Doctor[],
      hasNextPage: result.hasNextPage,
    }
  })
}

export async function findDoctorSpecialtiesByDoctorIds(
  payload: Payload,
  doctorIds: number[],
): Promise<Doctorspecialty[]> {
  if (doctorIds.length === 0) return []

  const allDocs: Doctorspecialty[] = []
  const doctorIdChunks = chunkArray(doctorIds, QUERY_CHUNK_SIZE)

  for (const doctorIdChunk of doctorIdChunks) {
    const chunkDocs = await collectAllPages<Doctorspecialty>(async (page) => {
      const result = await payload.find({
        collection: 'doctorspecialties',
        depth: 2,
        page,
        limit: QUERY_PAGE_SIZE,
        pagination: true,
        overrideAccess: false,
        where: {
          doctor: {
            in: doctorIdChunk,
          },
        },
        select: {
          id: true,
          doctor: true,
          medicalSpecialty: true,
          specializationLevel: true,
        },
      })

      return {
        docs: result.docs as Doctorspecialty[],
        hasNextPage: result.hasNextPage,
      }
    })

    allDocs.push(...chunkDocs)
  }

  return allDocs
}

export async function countApprovedClinicReviews(payload: Payload, clinicId: number): Promise<number> {
  const result = await payload.find({
    collection: 'reviews',
    depth: 0,
    limit: 1,
    page: 1,
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
            equals: clinicId,
          },
        },
      ],
    },
  })

  return result.totalDocs
}

export async function countApprovedDoctorReviews(payload: Payload, doctorIds: number[]): Promise<Map<number, number>> {
  const countsByDoctorId = new Map<number, number>()
  if (doctorIds.length === 0) return countsByDoctorId

  const doctorIdChunks = chunkArray(doctorIds, QUERY_CHUNK_SIZE)

  for (const doctorIdChunk of doctorIdChunks) {
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
              doctor: {
                in: doctorIdChunk,
              },
            },
          ],
        },
        select: {
          doctor: true,
        },
      })

      return {
        docs: result.docs as Review[],
        hasNextPage: result.hasNextPage,
      }
    })

    for (const review of chunkReviews) {
      const doctorId = extractRelationId(review.doctor)
      if (!doctorId) continue

      const currentCount = countsByDoctorId.get(doctorId) ?? 0
      countsByDoctorId.set(doctorId, currentCount + 1)
    }
  }

  return countsByDoctorId
}

export async function findClinicGalleryEntriesByIds(
  payload: Payload,
  entryIds: number[],
): Promise<ClinicGalleryEntry[]> {
  if (entryIds.length === 0) return []

  const allDocs: ClinicGalleryEntry[] = []
  const entryIdChunks = chunkArray(entryIds, QUERY_CHUNK_SIZE)

  for (const entryIdChunk of entryIdChunks) {
    const chunkDocs = await collectAllPages<ClinicGalleryEntry>(async (page) => {
      const result = await payload.find({
        collection: 'clinicGalleryEntries',
        depth: 2,
        page,
        limit: QUERY_PAGE_SIZE,
        pagination: true,
        overrideAccess: false,
        where: {
          id: {
            in: entryIdChunk,
          },
        },
        select: {
          id: true,
          clinic: true,
          title: true,
          beforeMedia: true,
          afterMedia: true,
          description: true,
          status: true,
          publishedAt: true,
        },
      })

      return {
        docs: result.docs as ClinicGalleryEntry[],
        hasNextPage: result.hasNextPage,
      }
    })

    allDocs.push(...chunkDocs)
  }

  return allDocs
}

export async function findAccreditationsByIds(payload: Payload, accreditationIds: number[]): Promise<Accreditation[]> {
  if (accreditationIds.length === 0) return []

  const allDocs: Accreditation[] = []
  const accreditationChunks = chunkArray(accreditationIds, QUERY_CHUNK_SIZE)

  for (const accreditationChunk of accreditationChunks) {
    const chunkDocs = await collectAllPages<Accreditation>(async (page) => {
      const result = await payload.find({
        collection: 'accreditation',
        depth: 0,
        page,
        limit: QUERY_PAGE_SIZE,
        pagination: true,
        overrideAccess: false,
        where: {
          id: {
            in: accreditationChunk,
          },
        },
        select: {
          id: true,
          name: true,
        },
      })

      return {
        docs: result.docs as Accreditation[],
        hasNextPage: result.hasNextPage,
      }
    })

    allDocs.push(...chunkDocs)
  }

  return allDocs
}

export async function findCitiesByIds(payload: Payload, cityIds: number[]): Promise<City[]> {
  if (cityIds.length === 0) return []

  const allDocs: City[] = []
  const cityChunks = chunkArray(cityIds, QUERY_CHUNK_SIZE)

  for (const cityChunk of cityChunks) {
    const chunkDocs = await collectAllPages<City>(async (page) => {
      const result = await payload.find({
        collection: 'cities',
        depth: 0,
        page,
        limit: QUERY_PAGE_SIZE,
        pagination: true,
        overrideAccess: false,
        where: {
          id: {
            in: cityChunk,
          },
        },
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

    allDocs.push(...chunkDocs)
  }

  return allDocs
}
