import type { Payload } from 'payload'

import type { Clinic } from '@/payload-types'

import {
  buildMediaDescriptorsByOwnerId,
  resolveMediaImageDescriptorForOwner,
  type MediaDescriptor,
} from './relationMedia'

const CLINIC_THUMBNAIL_PLACEHOLDER = '/images/placeholders/clinic-placeholder.webp'

export async function buildClinicThumbnailDescriptorsByClinicId({
  payload,
  clinics,
}: {
  payload: Payload
  clinics: Clinic[]
}): Promise<Map<number, MediaDescriptor>> {
  return buildMediaDescriptorsByOwnerId({
    payload,
    items: clinics,
    collection: 'clinicMedia',
    getOwnerId: (clinic) => clinic.id,
    getRelation: (clinic) => clinic.thumbnail,
  })
}

export function resolveClinicThumbnailImage({
  clinic,
  descriptorsByClinicId,
}: {
  clinic: Clinic
  descriptorsByClinicId?: ReadonlyMap<number, MediaDescriptor>
}): { src: string; alt: string } {
  const thumbnailDescriptor = resolveMediaImageDescriptorForOwner({
    ownerId: clinic.id,
    relation: clinic.thumbnail,
    collection: 'clinicMedia',
    descriptorsByOwnerId: descriptorsByClinicId,
  })

  return {
    src: thumbnailDescriptor?.url ?? CLINIC_THUMBNAIL_PLACEHOLDER,
    alt: thumbnailDescriptor?.alt ?? `${clinic.name} image`,
  }
}
