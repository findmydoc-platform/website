import type { Payload } from 'payload'

import type { Doctor } from '@/payload-types'

import { resolveAvatarPlaceholder } from '@/utilities/placeholders/avatar'

import {
  buildMediaDescriptorsByOwnerId,
  resolveMediaImageDescriptorForOwner,
  type MediaDescriptor,
} from './relationMedia'

function resolveDoctorDisplayName(doctor: Doctor): string {
  if (typeof doctor.fullName === 'string' && doctor.fullName.trim().length > 0) {
    return doctor.fullName
  }

  const parts = [doctor.firstName, doctor.lastName].filter((part) => typeof part === 'string' && part.trim().length > 0)
  const fallbackName = parts.join(' ').trim()
  return fallbackName.length > 0 ? fallbackName : `Doctor ${doctor.id}`
}

export async function buildDoctorProfileDescriptorsByDoctorId({
  payload,
  doctors,
}: {
  payload: Payload
  doctors: Doctor[]
}): Promise<Map<number, MediaDescriptor>> {
  return buildMediaDescriptorsByOwnerId({
    payload,
    items: doctors,
    collection: 'doctorMedia',
    getOwnerId: (doctor) => doctor.id,
    getRelation: (doctor) => doctor.profileImage,
  })
}

export function resolveDoctorProfileImage({
  doctor,
  descriptorsByDoctorId,
}: {
  doctor: Doctor
  descriptorsByDoctorId?: ReadonlyMap<number, MediaDescriptor>
}): { src: string; alt: string } {
  const profileImageDescriptor = resolveMediaImageDescriptorForOwner({
    ownerId: doctor.id,
    relation: doctor.profileImage,
    collection: 'doctorMedia',
    descriptorsByOwnerId: descriptorsByDoctorId,
  })

  return {
    src:
      profileImageDescriptor?.url ??
      resolveAvatarPlaceholder({
        persona: 'doctor',
        gender: doctor.gender,
      }),
    alt: profileImageDescriptor?.alt ?? `${resolveDoctorDisplayName(doctor)} portrait`,
  }
}
