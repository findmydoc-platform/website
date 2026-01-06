export type UiMedia = {
  src: string
  alt: string
  priority?: boolean
}

export type DoctorCardRating = {
  value: number
  reviewCount: number
}

export type DoctorSocialKind = 'facebook' | 'linkedin' | 'twitter'

export type DoctorSocialLink = {
  href: string
  label: string
  kind: DoctorSocialKind
}

export type DoctorActionLink = {
  href: string
  label: string
}

export type DoctorCardActions = {
  availability?: DoctorActionLink
  call?: DoctorActionLink
  chat?: DoctorActionLink
  booking?: DoctorActionLink
}

export type DoctorCardData = {
  name: string
  subtitle?: string
  description?: string
  rating?: DoctorCardRating
  socialLinks?: DoctorSocialLink[]
  actions?: DoctorCardActions
}

export type RelatedDoctorItem = {
  id: string
  heroMedia: UiMedia
  card: DoctorCardData
}
