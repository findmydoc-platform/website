import type { VerificationBadgeVariant } from '@/components/atoms/verification-badge'
import type { ListingCardData } from '@/components/organisms/Listing'
import type { Clinic } from '@/payload-types'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import {
  extractMediaRelationId,
  getMediaDescriptorFromRelation,
  type MediaDescriptor,
} from '@/utilities/media/relationMedia'
import { slugify } from '@/utilities/slugify'
import { resolveScopedPriceFrom } from './pricing'
import { extractRelationId } from './relations'
import type { CityMeta, ClinicPresentationMeta, ClinicRow } from './types'

const DEFAULT_LOCATION_LABEL = 'Unknown location'
const PLACEHOLDER_MEDIA = {
  src: '/images/placeholder-576-968.svg',
  alt: 'Clinic placeholder image',
}

function normalizeVerification(value: unknown): VerificationBadgeVariant {
  if (value === 'bronze' || value === 'silver' || value === 'gold' || value === 'unverified') {
    return value
  }
  return 'unverified'
}

function mapLocationHref(coordinates: unknown): string | undefined {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return undefined

  const lat = Number(coordinates[0])
  const lng = Number(coordinates[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined

  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`
}

export function buildClinicPresentationMeta(
  clinic: Clinic,
  cityMetaById: Map<number, CityMeta>,
): ClinicPresentationMeta {
  const cityRelation = clinic.address?.city
  const cityId = extractRelationId(cityRelation)
  const cityName =
    typeof cityRelation === 'object' && cityRelation !== null && 'name' in cityRelation
      ? String((cityRelation as { name?: unknown }).name ?? '')
      : ((cityId ? cityMetaById.get(cityId)?.name : undefined) ?? '')

  const country = clinic.address?.country ?? ''
  const location = [cityName, country].filter((item) => item && item.trim().length > 0).join(', ')

  return {
    cityId,
    location: location || DEFAULT_LOCATION_LABEL,
    locationHref: mapLocationHref(clinic.coordinates),
  }
}

export function buildScopedClinicRows({
  clinics,
  selectedCityIds,
  treatmentScope,
  presentationByClinicId,
  minPriceByTreatmentByClinicId,
}: {
  clinics: Clinic[]
  selectedCityIds: Set<number>
  treatmentScope: Set<number> | null
  presentationByClinicId: Map<number, ClinicPresentationMeta>
  minPriceByTreatmentByClinicId: Map<number, Map<number, number>>
}): ClinicRow[] {
  return clinics.flatMap<ClinicRow>((clinic) => {
    const presentation = presentationByClinicId.get(clinic.id)
    const cityId = presentation?.cityId ?? null

    if (selectedCityIds.size > 0 && (!cityId || !selectedCityIds.has(cityId))) {
      return []
    }

    const priceFrom = resolveScopedPriceFrom(minPriceByTreatmentByClinicId.get(clinic.id), treatmentScope)

    if (treatmentScope !== null && priceFrom === null) {
      return []
    }

    return [
      {
        clinic,
        cityId,
        location: presentation?.location ?? DEFAULT_LOCATION_LABEL,
        locationHref: presentation?.locationHref,
        priceFrom,
      },
    ]
  })
}

export function mapListingCardResults(
  pageRows: ClinicRow[],
  reviewCounts: Map<number, number>,
  clinicMediaById: Map<number, MediaDescriptor>,
): ListingCardData[] {
  return pageRows.map(({ clinic, location, locationHref, priceFrom }) => {
    const ratingValue = typeof clinic.averageRating === 'number' ? clinic.averageRating : 0
    const ratingCount = reviewCounts.get(clinic.id) ?? 0
    const relationMedia = getMediaDescriptorFromRelation(clinic.thumbnail)
    const thumbnailId = extractMediaRelationId(clinic.thumbnail)
    const mappedClinicMedia = thumbnailId ? clinicMediaById.get(thumbnailId) : undefined
    const mediaSrc =
      getMediaUrl(clinic.thumbnail) ?? relationMedia?.url ?? mappedClinicMedia?.url ?? PLACEHOLDER_MEDIA.src
    const mediaAlt =
      typeof clinic.thumbnail === 'object' &&
      clinic.thumbnail !== null &&
      'alt' in clinic.thumbnail &&
      typeof clinic.thumbnail.alt === 'string' &&
      clinic.thumbnail.alt.trim().length > 0
        ? clinic.thumbnail.alt
        : typeof relationMedia?.alt === 'string' && relationMedia.alt.trim().length > 0
          ? relationMedia.alt
          : typeof mappedClinicMedia?.alt === 'string' && mappedClinicMedia.alt.trim().length > 0
            ? mappedClinicMedia.alt
            : `${clinic.name} image`
    const tags =
      clinic.tags?.flatMap((tag) => {
        if (typeof tag === 'object' && tag !== null && 'name' in tag && typeof tag.name === 'string') {
          return [tag.name]
        }
        return []
      }) ?? []

    const slug = clinic.slug || slugify(clinic.name)

    return {
      id: clinic.id,
      name: clinic.name,
      location,
      locationHref,
      media: {
        src: mediaSrc,
        alt: mediaAlt || PLACEHOLDER_MEDIA.alt,
      },
      verification: {
        variant: normalizeVerification(clinic.verification),
      },
      rating: {
        value: ratingValue,
        count: ratingCount,
      },
      tags,
      priceFrom:
        priceFrom !== null
          ? {
              value: priceFrom,
              currency: 'USD',
              label: 'From',
            }
          : undefined,
      actions: {
        details: {
          href: `#${encodeURIComponent(slug)}`,
          label: 'Details',
        },
        compare: {
          href: '#',
          label: 'Compare',
        },
      },
    }
  })
}
