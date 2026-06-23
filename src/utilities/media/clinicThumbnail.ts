import type { Payload } from 'payload'

import type { Clinic } from '@/payload-types'

import {
  extractMediaRelationId,
  findMediaDescriptorsByIds,
  resolveMediaDescriptorFromLoadedRelation,
  type MediaDescriptor,
} from './relationMedia'

const CLINIC_THUMBNAIL_PLACEHOLDER = '/images/placeholder-576-968.svg'

function resolveLoadedThumbnailDescriptor(clinic: Clinic): MediaDescriptor | undefined {
  return resolveMediaDescriptorFromLoadedRelation(clinic.thumbnail, 'clinicMedia')
}

export async function buildClinicThumbnailDescriptorsByClinicId({
  payload,
  clinics,
}: {
  payload: Payload
  clinics: Clinic[]
}): Promise<Map<number, MediaDescriptor>> {
  const thumbnailIds = Array.from(
    new Set(
      clinics
        .map((clinic) => extractMediaRelationId(clinic.thumbnail))
        .filter((id): id is number => typeof id === 'number'),
    ),
  )

  if (thumbnailIds.length === 0) {
    return new Map()
  }

  const descriptorsByThumbnailId = await findMediaDescriptorsByIds({
    payload,
    collection: 'clinicMedia',
    ids: thumbnailIds,
  })

  const descriptorsByClinicId = new Map<number, MediaDescriptor>()

  for (const clinic of clinics) {
    const thumbnailId = extractMediaRelationId(clinic.thumbnail)
    if (!thumbnailId) continue

    const loadedDescriptor = resolveLoadedThumbnailDescriptor(clinic)
    const descriptor = loadedDescriptor?.url ? loadedDescriptor : descriptorsByThumbnailId.get(thumbnailId)
    if (descriptor?.url) {
      descriptorsByClinicId.set(clinic.id, descriptor)
    }
  }

  return descriptorsByClinicId
}

export function resolveClinicThumbnailImage({
  clinic,
  descriptorsByClinicId,
}: {
  clinic: Clinic
  descriptorsByClinicId?: ReadonlyMap<number, MediaDescriptor>
}): { src: string; alt: string } {
  const loadedDescriptor = resolveLoadedThumbnailDescriptor(clinic)
  const thumbnailDescriptor = loadedDescriptor?.url ? loadedDescriptor : descriptorsByClinicId?.get(clinic.id)

  return {
    src: thumbnailDescriptor?.url ?? CLINIC_THUMBNAIL_PLACEHOLDER,
    alt: thumbnailDescriptor?.alt ?? `${clinic.name} image`,
  }
}
