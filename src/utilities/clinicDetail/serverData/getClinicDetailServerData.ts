import type { Payload } from 'payload'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'
import type { Accreditation, City, ClinicMedia } from '@/payload-types'

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
import { resolveMediaDescriptorFromLoadedRelation } from '@/utilities/media/relationMedia'
import { richTextToPlainText } from '@/features/clinicDashboard/profile/richText'
import { mapClinicToClinicDetailData } from './mappers'
import {
  countApprovedClinicReviews,
  countApprovedDoctorReviews,
  findAccreditationsByIds,
  findApprovedClinicReviewsByClinicId,
  findCitiesByIds,
  findClinicBySlug,
  findClinicTreatmentsByClinicId,
  findDoctorsByClinicId,
  findDoctorSpecialtiesByDoctorIds,
  findPublicReviewResponsesByReviewIds,
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
  buildCollectionTag('reviewResponses'),
  buildCollectionTag('accreditation'),
  buildCollectionTag('cities'),
  buildCollectionTag('countries'),
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

async function buildPublicGalleryImages(payload: Payload, clinic: Awaited<ReturnType<typeof findClinicBySlug>>) {
  if (!clinic || !Array.isArray(clinic.profileGallery) || clinic.profileGallery.length === 0) return []
  const ids = clinic.profileGallery.map(extractRelationId).filter((id): id is number => id !== null)
  if (ids.length === 0) return []

  const result = await payload.find({
    collection: 'clinicMedia',
    depth: 0,
    limit: ids.length,
    pagination: false,
    overrideAccess: true,
    where: {
      and: [{ id: { in: ids } }, { clinic: { equals: clinic.id } }, { status: { equals: 'published' } }],
    },
  })
  const byId = new Map(result.docs.map((media) => [media.id, media as ClinicMedia]))

  return ids.flatMap((id) => {
    const media = byId.get(id)
    if (!media) return []
    const descriptor = resolveMediaDescriptorFromLoadedRelation(media, 'clinicMedia')
    if (!descriptor?.url || !descriptor.alt?.trim()) return []
    const caption = richTextToPlainText(media.caption)
    return [{ id: String(media.id), src: descriptor.url, alt: descriptor.alt, ...(caption ? { caption } : {}) }]
  })
}

export async function getClinicDetailServerData(
  payload: Payload,
  slug: string,
  options: ClinicDetailServerDataOptions,
): Promise<ClinicDetailServerDataResult> {
  const clinic = await findClinicBySlug(payload, slug, options.draft)
  if (!clinic) return null
  const galleryImagesPromise = buildPublicGalleryImages(payload, clinic)

  const [clinicTreatments, doctors, clinicReviewCount, approvedClinicReviews] = await Promise.all([
    findClinicTreatmentsByClinicId(payload, clinic.id),
    findDoctorsByClinicId(payload, clinic.id),
    countApprovedClinicReviews(payload, clinic.id),
    findApprovedClinicReviewsByClinicId(payload, clinic.id),
  ])

  const doctorIds = doctors.map((doctor) => doctor.id)
  const reviewIds = approvedClinicReviews.map((review) => review.id)

  const [doctorSpecialties, doctorReviewCounts, doctorMediaByDoctorId, reviewResponses] = await Promise.all([
    findDoctorSpecialtiesByDoctorIds(payload, doctorIds),
    countApprovedDoctorReviews(payload, doctorIds),
    buildDoctorProfileDescriptorsByDoctorId({
      payload,
      doctors,
    }),
    findPublicReviewResponsesByReviewIds(payload, reviewIds),
  ])

  const accreditationLookupIds = collectAccreditationLookupIds(clinic.accreditations)
  const cityLookupIds = collectCityLookupIds(clinic.address?.city)

  const [accreditationDocs, cityDocs] = await Promise.all([
    findAccreditationsByIds(payload, accreditationLookupIds),
    findCitiesByIds(payload, cityLookupIds),
  ])

  const [clinicThumbnailDescriptorsByClinicId, galleryImages] = await Promise.all([
    buildClinicThumbnailDescriptorsByClinicId({ payload, clinics: [clinic] }),
    galleryImagesPromise,
  ])

  return mapClinicToClinicDetailData({
    clinic,
    heroImage: resolveClinicThumbnailImage({
      clinic,
      descriptorsByClinicId: clinicThumbnailDescriptorsByClinicId,
    }),
    galleryImages,
    clinicTreatments,
    doctors,
    doctorSpecialties,
    doctorMediaByDoctorId,
    clinicReviewCount,
    approvedClinicReviews,
    reviewResponses,
    doctorReviewCounts,
    accreditations: accreditationDocs as Accreditation[],
    cities: cityDocs as City[],
  })
}
