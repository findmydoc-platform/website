import type { Payload } from 'payload'

import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import type { VerificationBadgeVariant } from '@/components/atoms/verification-badge'
import { ensurePatientOnAuth } from '@/hooks/ensurePatientOnAuth'
import type { Clinic, Favoriteclinic, Patient } from '@/payload-types'
import { resolveMediaDescriptorFromLoadedRelation } from '@/utilities/media/relationMedia'
import { slugify } from '@/utilities/slugify'

const FAVORITES_PAGE_LIMIT = 100
const PLACEHOLDER_MEDIA = {
  src: '/images/placeholder-576-968.svg',
  alt: 'Clinic placeholder image',
}

export type FavoriteClinicStateRecord = Record<string, number>

export type FavoriteClinicAuthContext = {
  isPatient: boolean
  patient: Patient | null
}

export type FavoriteClinicListItem = {
  favoriteId: number
  clinicId: number
  name: string
  href: string
  location: string
  media: {
    src: string
    alt: string
  }
  verification: {
    variant: VerificationBadgeVariant
  }
  ratingValue?: number
}

function extractRelationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (value && typeof value === 'object' && 'id' in value) {
    return extractRelationId((value as { id?: unknown }).id)
  }

  return null
}

function isLoadedClinic(value: unknown): value is Clinic {
  return Boolean(value && typeof value === 'object' && 'id' in value && 'name' in value)
}

function normalizeVerification(value: unknown): VerificationBadgeVariant {
  if (value === 'bronze' || value === 'silver' || value === 'gold' || value === 'unverified') {
    return value
  }

  return 'unverified'
}

function resolveClinicLocation(clinic: Clinic): string {
  const cityRelation = clinic.address?.city
  const cityName =
    cityRelation && typeof cityRelation === 'object' && 'name' in cityRelation
      ? String(cityRelation.name ?? '').trim()
      : ''
  const country = typeof clinic.address?.country === 'string' ? clinic.address.country.trim() : ''

  return [cityName, country].filter((item) => item.length > 0).join(', ') || 'Location not listed'
}

function mapFavoriteToListItem(favorite: Favoriteclinic): FavoriteClinicListItem | null {
  if (!isLoadedClinic(favorite.clinic)) return null

  const clinic = favorite.clinic
  const resolvedMedia = resolveMediaDescriptorFromLoadedRelation(clinic.thumbnail, 'clinicMedia')
  const slug = clinic.slug || slugify(clinic.name)

  return {
    favoriteId: favorite.id,
    clinicId: clinic.id,
    name: clinic.name,
    href: `/clinics/${encodeURIComponent(slug)}`,
    location: resolveClinicLocation(clinic),
    media: {
      src: resolvedMedia?.url ?? PLACEHOLDER_MEDIA.src,
      alt:
        typeof resolvedMedia?.alt === 'string' && resolvedMedia.alt.trim().length > 0
          ? resolvedMedia.alt
          : `${clinic.name} image`,
    },
    verification: {
      variant: normalizeVerification(clinic.verification),
    },
    ratingValue: typeof clinic.averageRating === 'number' ? clinic.averageRating : undefined,
  }
}

export async function resolveFavoriteClinicAuthContext({
  payload,
  headers,
}: {
  payload: Payload
  headers?: Headers
}): Promise<FavoriteClinicAuthContext> {
  const authData = await extractSupabaseUserData({ headers })

  if (!authData || authData.userType !== 'patient') {
    return {
      isPatient: false,
      patient: null,
    }
  }

  try {
    const patient = (await ensurePatientOnAuth({
      payload,
      authData,
      req: undefined,
    })) as Patient

    return {
      isPatient: true,
      patient,
    }
  } catch {
    return {
      isPatient: false,
      patient: null,
    }
  }
}

export async function findFavoriteClinicStateRecord({
  payload,
  patientId,
  clinicIds,
}: {
  payload: Payload
  patientId: number
  clinicIds: number[]
}): Promise<FavoriteClinicStateRecord> {
  const uniqueClinicIds = Array.from(new Set(clinicIds.filter((id) => Number.isFinite(id))))
  if (uniqueClinicIds.length === 0) return {}

  const result = await payload.find({
    collection: 'favoriteclinics',
    depth: 0,
    limit: uniqueClinicIds.length,
    pagination: false,
    overrideAccess: true,
    where: {
      and: [
        {
          patient: {
            equals: patientId,
          },
        },
        {
          clinic: {
            in: uniqueClinicIds,
          },
        },
      ],
    },
    select: {
      id: true,
      clinic: true,
    },
  })

  return result.docs.reduce<FavoriteClinicStateRecord>((record, favorite) => {
    const clinicId = extractRelationId((favorite as Favoriteclinic).clinic)
    if (!clinicId) return record

    record[String(clinicId)] = favorite.id
    return record
  }, {})
}

export async function findPatientFavoriteClinicListItems({
  payload,
  patientId,
}: {
  payload: Payload
  patientId: number
}): Promise<FavoriteClinicListItem[]> {
  const result = await payload.find({
    collection: 'favoriteclinics',
    depth: 2,
    limit: FAVORITES_PAGE_LIMIT,
    pagination: false,
    overrideAccess: true,
    sort: '-createdAt',
    where: {
      patient: {
        equals: patientId,
      },
    },
  })

  return result.docs.flatMap((favorite) => {
    const item = mapFavoriteToListItem(favorite as Favoriteclinic)
    return item ? [item] : []
  })
}
