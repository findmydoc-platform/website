import type { Payload } from 'payload'

import type { Doctor } from '@/payload-types'

import { resolveAvatarPlaceholder } from '@/utilities/placeholders/avatar'

import {
  extractMediaRelationId,
  findMediaDescriptorsByIds,
  resolveMediaDescriptorFromLoadedRelation,
  type MediaDescriptor,
} from './relationMedia'

function resolveLoadedProfileImageDescriptor(doctor: Doctor): MediaDescriptor | undefined {
  return resolveMediaDescriptorFromLoadedRelation(doctor.profileImage, 'doctorMedia')
}

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
  const profileImageIds = Array.from(
    new Set(
      doctors
        .map((doctor) => extractMediaRelationId(doctor.profileImage))
        .filter((id): id is number => typeof id === 'number'),
    ),
  )

  if (profileImageIds.length === 0) {
    return new Map()
  }

  const descriptorsByProfileImageId = await findMediaDescriptorsByIds({
    payload,
    collection: 'doctorMedia',
    ids: profileImageIds,
  })

  const descriptorsByDoctorId = new Map<number, MediaDescriptor>()

  for (const doctor of doctors) {
    const profileImageId = extractMediaRelationId(doctor.profileImage)
    if (!profileImageId) continue

    const loadedDescriptor = resolveLoadedProfileImageDescriptor(doctor)
    const descriptor = loadedDescriptor?.url ? loadedDescriptor : descriptorsByProfileImageId.get(profileImageId)
    if (descriptor?.url) {
      descriptorsByDoctorId.set(doctor.id, descriptor)
    }
  }

  return descriptorsByDoctorId
}

export function resolveDoctorProfileImage({
  doctor,
  descriptorsByDoctorId,
}: {
  doctor: Doctor
  descriptorsByDoctorId?: ReadonlyMap<number, MediaDescriptor>
}): { src: string; alt: string } {
  const loadedDescriptor = resolveLoadedProfileImageDescriptor(doctor)
  const profileImageDescriptor = loadedDescriptor?.url ? loadedDescriptor : descriptorsByDoctorId?.get(doctor.id)

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
