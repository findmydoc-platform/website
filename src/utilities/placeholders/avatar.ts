export type AvatarPersona = 'author' | 'doctor' | 'patient'
export type AvatarGender = 'female' | 'male'
type GenderedAvatarPersona = Exclude<AvatarPersona, 'author'>

type ResolveAvatarPlaceholderArgs = {
  persona: AvatarPersona
  gender?: AvatarGender | null
}

const AVATAR_PLACEHOLDER_MAP: Record<GenderedAvatarPersona, Record<AvatarGender, string>> = {
  doctor: {
    female: '/images/placeholders/doctor-female-placeholder.webp',
    male: '/images/placeholders/doctor-male-placeholder.webp',
  },
  patient: {
    female: '/images/avatar-patient-female-placeholder.svg',
    male: '/images/avatar-patient-male-placeholder.svg',
  },
}

const DEFAULT_AVATAR_PLACEHOLDER_MAP: Record<AvatarPersona, string> = {
  author: '/images/placeholders/author-neutral-placeholder.webp',
  doctor: '/images/placeholders/doctor-neutral-placeholder.webp',
  patient: '/images/avatar-placeholder.svg',
}

export function resolveAvatarPlaceholder({ persona, gender }: ResolveAvatarPlaceholderArgs): string {
  if (persona !== 'author' && (gender === 'female' || gender === 'male')) {
    return AVATAR_PLACEHOLDER_MAP[persona][gender]
  }

  return DEFAULT_AVATAR_PLACEHOLDER_MAP[persona]
}
