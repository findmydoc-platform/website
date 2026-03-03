export type AvatarPersona = 'doctor' | 'patient'
export type AvatarGender = 'female' | 'male'

type ResolveAvatarPlaceholderArgs = {
  persona: AvatarPersona
  gender?: AvatarGender | null
}

const AVATAR_PLACEHOLDER_MAP: Record<AvatarPersona, Record<AvatarGender, string>> = {
  doctor: {
    female: '/images/avatar-doctor-female-placeholder.svg',
    male: '/images/avatar-doctor-male-placeholder.svg',
  },
  patient: {
    female: '/images/avatar-patient-female-placeholder.svg',
    male: '/images/avatar-patient-male-placeholder.svg',
  },
}

const DEFAULT_AVATAR_PLACEHOLDER = '/images/avatar-placeholder.svg'

export function resolveAvatarPlaceholder({ persona, gender }: ResolveAvatarPlaceholderArgs): string {
  if (gender === 'female' || gender === 'male') {
    return AVATAR_PLACEHOLDER_MAP[persona][gender]
  }

  return DEFAULT_AVATAR_PLACEHOLDER
}
