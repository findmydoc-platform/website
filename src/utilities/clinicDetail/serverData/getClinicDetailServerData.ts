import type { Payload } from 'payload'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'
import type { Accreditation, City, ClinicGalleryEntry } from '@/payload-types'

import {
  buildCollectionTag,
  buildEntityTag,
  buildSlugTag,
  buildSurfaceInstanceTag,
  buildSurfaceTag,
} from '@/utilities/cachePolicy'
import {
  buildClinicThumbnailDescriptorsByClinicId,
  resolveClinicThumbnailImage,
} from '@/utilities/media/clinicThumbnail'
import { buildDoctorProfileDescriptorsByDoctorId } from '@/utilities/media/doctorProfileImage'
import { mapClinicToClinicDetailData } from './mappers'
import {
  countApprovedClinicReviews,
  countApprovedDoctorReviews,
  findAccreditationsByIds,
  findApprovedClinicReviewsByClinicId,
  findCitiesByIds,
  findClinicBySlug,
  findClinicGalleryEntriesByIds,
  findClinicTreatmentsByClinicId,
  findDoctorsByClinicId,
  findDoctorSpecialtiesByDoctorIds,
} from './repositories'
import type { ClinicDetailServerDataOptions, ClinicDetailServerDataResult } from './types'

type PublicClinicIdentity = {
  id: string | number
  slug: string
}

const CLINIC_DETAIL_RELATED_COLLECTION_TAGS = [
  buildCollectionTag('clinictreatments'),
  buildCollectionTag('doctors'),
  buildCollectionTag('doctorspecialties'),
  buildCollectionTag('reviews'),
  buildCollectionTag('accreditation'),
  buildCollectionTag('clinicGalleryEntries'),
  buildCollectionTag('cities'),
] as const

export const buildClinicDetailIdentityCacheTags = (slug: string): string[] => [
  buildSlugTag('clinics', slug),
  buildSurfaceTag('clinic-detail'),
]

export const buildClinicDetailDataCacheTags = ({ id, slug }: PublicClinicIdentity): string[] => [
  buildEntityTag('clinics', id),
  buildSlugTag('clinics', slug),
  buildSurfaceTag('clinic-detail'),
  buildSurfaceInstanceTag('clinic-detail', id),
  ...CLINIC_DETAIL_RELATED_COLLECTION_TAGS,
]

async function findPublicClinicIdentityBySlug(payload: Payload, slug: string): Promise<PublicClinicIdentity | null> {
  const result = await payload.find({
    collection: 'clinics',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: false,
    where: {
      and: [
        {
          slug: {
            equals: slug,
          },
        },
        {
          status: {
            equals: 'approved',
          },
        },
      ],
    },
    select: {
      id: true,
      slug: true,
      status: true,
    },
  })

  const clinic = result.docs[0] as { id?: unknown; slug?: unknown; status?: unknown } | undefined
  if (!clinic || clinic.status !== 'approved') return null

  const id = typeof clinic.id === 'number' || typeof clinic.id === 'string' ? clinic.id : null
  const normalizedSlug = typeof clinic.slug === 'string' ? clinic.slug.trim() : ''

  if (id === null || !normalizedSlug) return null

  return {
    id,
    slug: normalizedSlug,
  }
}

const getCachedPublicClinicIdentity = (slug: string) =>
  unstable_cache(
    async () => {
      const payload = await getPayload({ config: configPromise })

      return findPublicClinicIdentityBySlug(payload, slug)
    },
    ['clinic-detail-identity', slug],
    {
      tags: buildClinicDetailIdentityCacheTags(slug),
    },
  )

const getCachedPublicClinicDetailServerDataByIdentity = ({ id, slug }: PublicClinicIdentity) =>
  unstable_cache(
    async () => {
      const payload = await getPayload({ config: configPromise })

      return getClinicDetailServerData(payload, slug, { draft: false })
    },
    ['clinic-detail-server-data', String(id), slug],
    {
      tags: buildClinicDetailDataCacheTags({ id, slug }),
    },
  )

export async function getCachedPublicClinicDetailServerData(slug: string): Promise<ClinicDetailServerDataResult> {
  const identity = await getCachedPublicClinicIdentity(slug)()
  if (!identity) return null

  return getCachedPublicClinicDetailServerDataByIdentity(identity)()
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

function collectLookupIds<T>(items: T[], getId: (item: T) => number | null): number[] {
  return Array.from(new Set(items.map(getId).filter((id): id is number => typeof id === 'number')))
}

function collectAccreditationLookupIds(clinicAccreditations: unknown[] | null | undefined): number[] {
  return collectLookupIds(clinicAccreditations ?? [], (item) => {
    if (!item || typeof item !== 'object') {
      return extractRelationId(item)
    }

    const hasName = 'name' in item && typeof item.name === 'string' && item.name.trim().length > 0
    return hasName ? null : extractRelationId(item)
  })
}

function collectCityLookupIds(cityRelation: unknown): number[] {
  if (
    cityRelation &&
    typeof cityRelation === 'object' &&
    'name' in cityRelation &&
    typeof cityRelation.name === 'string'
  ) {
    return []
  }

  const cityId = extractRelationId(cityRelation)
  return typeof cityId === 'number' ? [cityId] : []
}

function collectGalleryEntryLookupIds(galleryRelations: unknown[] | null | undefined): number[] {
  return collectLookupIds(galleryRelations ?? [], (item) => extractRelationId(item))
}

function mergeGalleryEntries(
  relations: unknown[] | null | undefined,
  fetchedEntries: ClinicGalleryEntry[],
): ClinicGalleryEntry[] {
  const mapById = new Map<number, ClinicGalleryEntry>()

  for (const entry of fetchedEntries) {
    mapById.set(entry.id, entry)
  }

  for (const relation of relations ?? []) {
    if (relation && typeof relation === 'object' && 'id' in relation) {
      mapById.set(relation.id as number, relation as ClinicGalleryEntry)
    }
  }

  return Array.from(mapById.values())
}

export async function getClinicDetailServerData(
  payload: Payload,
  slug: string,
  options: ClinicDetailServerDataOptions,
): Promise<ClinicDetailServerDataResult> {
  const clinic = await findClinicBySlug(payload, slug, options.draft)
  if (!clinic) return null

  const [clinicTreatments, doctors, clinicReviewCount, approvedClinicReviews] = await Promise.all([
    findClinicTreatmentsByClinicId(payload, clinic.id),
    findDoctorsByClinicId(payload, clinic.id),
    countApprovedClinicReviews(payload, clinic.id),
    findApprovedClinicReviewsByClinicId(payload, clinic.id),
  ])

  const doctorIds = doctors.map((doctor) => doctor.id)

  const [doctorSpecialties, doctorReviewCounts, doctorMediaByDoctorId] = await Promise.all([
    findDoctorSpecialtiesByDoctorIds(payload, doctorIds),
    countApprovedDoctorReviews(payload, doctorIds),
    buildDoctorProfileDescriptorsByDoctorId({
      payload,
      doctors,
    }),
  ])

  const accreditationLookupIds = collectAccreditationLookupIds(clinic.accreditations)
  const cityLookupIds = collectCityLookupIds(clinic.address?.city)
  const galleryEntryLookupIds = collectGalleryEntryLookupIds(clinic.galleryEntries)

  const [accreditationDocs, cityDocs, fetchedGalleryEntries] = await Promise.all([
    findAccreditationsByIds(payload, accreditationLookupIds),
    findCitiesByIds(payload, cityLookupIds),
    findClinicGalleryEntriesByIds(payload, galleryEntryLookupIds),
  ])

  const galleryEntries = mergeGalleryEntries(clinic.galleryEntries, fetchedGalleryEntries)
  const clinicThumbnailDescriptorsByClinicId = await buildClinicThumbnailDescriptorsByClinicId({
    payload,
    clinics: [clinic],
  })

  return mapClinicToClinicDetailData({
    clinic,
    heroImage: resolveClinicThumbnailImage({
      clinic,
      descriptorsByClinicId: clinicThumbnailDescriptorsByClinicId,
    }),
    clinicTreatments,
    doctors,
    doctorSpecialties,
    doctorMediaByDoctorId,
    clinicReviewCount,
    approvedClinicReviews,
    doctorReviewCounts,
    galleryEntries,
    accreditations: accreditationDocs as Accreditation[],
    cities: cityDocs as City[],
  })
}
