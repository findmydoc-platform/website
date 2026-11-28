import type { Payload } from 'payload'

import type { Clinic } from '@/payload-types'

import { buildMediaDescriptorsByOwnerId, type MediaDescriptor } from './relationMedia'

export const CLINIC_THUMBNAIL_PLACEHOLDER = '/images/placeholders/clinic-placeholder.webp'

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
