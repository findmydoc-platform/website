import type { Payload } from 'payload'

import type { Doctor } from '@/payload-types'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { resolveAvatarPlaceholder } from '@/utilities/placeholders/avatar'

import { buildMediaDescriptorsByOwnerId, type MediaDescriptor } from './relationMedia'

export async function buildDoctorProfileDescriptorsByDoctorId({
  payload,
  doctors,
  locale,
}: {
  payload: Payload
  doctors: Doctor[]
  locale: UiCopyLocale
}): Promise<Map<number, MediaDescriptor>> {
  return buildMediaDescriptorsByOwnerId({
    payload,
    items: doctors,
    collection: 'doctorMedia',
    getOwnerId: (doctor) => doctor.id,
    getRelation: (doctor) => doctor.profileImage,
    locale,
  })
}

export function resolveDoctorProfileImage({
  doctor,
  descriptorsByDoctorId,
  fallbackAlt,
}: {
  doctor: Doctor
  descriptorsByDoctorId?: ReadonlyMap<number, MediaDescriptor>
  fallbackAlt: string
}): { src: string; alt: string } {
  const image = descriptorsByDoctorId?.get(doctor.id)
  return image?.url
    ? { src: image.url, alt: image.alt || fallbackAlt }
    : { src: resolveAvatarPlaceholder({ persona: 'doctor', gender: doctor.gender }), alt: '' }
}
