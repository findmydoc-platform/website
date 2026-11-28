import type { Payload } from 'payload'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'
import type { Accreditation, City, Clinic } from '@/payload-types'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { getClinicProfileTranslator } from '@/features/clinicDetail/overviewCopy'

import {
  buildCollectionTag,
  buildEntityTag,
  buildSlugTag,
  buildSurfaceInstanceTag,
  buildSurfaceTag,
} from '@/utilities/cachePolicy'
import { CLINIC_THUMBNAIL_PLACEHOLDER } from '@/utilities/media/clinicThumbnail'
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

const getCachedPublicClinicDetailServerDataByIdentity = ({ id, slug }: PublicClinicIdentity, locale: UiCopyLocale) =>
  unstable_cache(
    async () => {
      const payload = await getPayload({ config: configPromise })

      return getClinicDetailServerData(payload, slug, { draft: false, locale })
    },
    ['clinic-detail-server-data-v2', String(id), slug, locale],
    {
      tags: buildClinicDetailDataCacheTags({ id, slug }),
    },
  )

export async function getCachedPublicClinicDetailServerData(
  slug: string,
  locale: UiCopyLocale,
): Promise<ClinicDetailServerDataResult> {
  const identity = await getCachedPublicClinicIdentity(slug)()
  if (!identity) return null

  return getCachedPublicClinicDetailServerDataByIdentity(identity, locale)()
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

async function buildPublicProfileImages(payload: Payload, clinic: Clinic, locale: UiCopyLocale) {
  const galleryIds = (clinic.profileGallery ?? []).map(extractRelationId).filter((id) => id !== null)
  const thumbnailId = extractRelationId(clinic.thumbnail)
  const ids = [...new Set(thumbnailId === null ? galleryIds : [...galleryIds, thumbnailId])]
  const placeholder = { src: CLINIC_THUMBNAIL_PLACEHOLDER, alt: '' }
  if (ids.length === 0) return { galleryImages: [], heroImage: placeholder }

  const result = await payload.find({
    collection: 'clinicMedia',
    depth: 0,
    limit: ids.length,
    pagination: false,
    // Gallery files are publicly readable, but their REST documents remain staff-scoped.
    overrideAccess: true,
    locale,
    fallbackLocale: false,
    select: {
      filename: true,
      url: true,
      updatedAt: true,
      alt: true,
      caption: true,
      localizedAlt: true,
      localizedCaption: true,
    },
    where: {
      and: [{ id: { in: ids } }, { clinic: { equals: clinic.id } }, { status: { equals: 'published' } }],
    },
  })
  const fallbackAlt = getClinicProfileTranslator(locale)('overview.mediaAlt', { clinic: clinic.name })
  const byId = new Map(
    result.docs.flatMap((media) => {
      const descriptor = resolveMediaDescriptorFromLoadedRelation(media, 'clinicMedia')
      if (!descriptor?.url) return []
      const alt = media.localizedAlt?.trim() || (locale === 'en' ? descriptor.alt?.trim() : undefined) || fallbackAlt
      const caption = richTextToPlainText(media.localizedCaption ?? (locale === 'en' ? media.caption : undefined))
      return [[media.id, { id: String(media.id), src: descriptor.url, alt, ...(caption ? { caption } : {}) }]] as const
    }),
  )

  const galleryImages = galleryIds.flatMap((id) => {
    const image = byId.get(id)
    return image ? [image] : []
  })
  const thumbnail = thumbnailId === null ? undefined : byId.get(thumbnailId)
  const heroImage = thumbnail ? { src: thumbnail.src, alt: thumbnail.alt } : placeholder
  return { galleryImages, heroImage }
}

export async function getClinicDetailServerData(
  payload: Payload,
  slug: string,
  options: ClinicDetailServerDataOptions,
): Promise<ClinicDetailServerDataResult> {
  const { draft, locale } = options
  const clinic = await findClinicBySlug(payload, slug, draft, locale)
  if (!clinic) return null
  const profileImages = buildPublicProfileImages(payload, clinic, locale)

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
    findCitiesByIds(payload, cityLookupIds, locale),
  ])

  const { galleryImages, heroImage } = await profileImages

  return mapClinicToClinicDetailData({
    clinic,
    locale,
    heroImage,
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
