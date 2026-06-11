import type { CookieConsentConfig, CookieConsentState } from '@/features/cookieConsent'

export type ClinicVerificationTier = 'unverified' | 'bronze' | 'silver' | 'gold'

export type ClinicDetailDoctorSocialLink = {
  kind: 'facebook' | 'linkedin' | 'meta' | 'twitter' | 'x'
  href: string
  label: string
}

export type ClinicDetailDoctor = {
  id: string
  name: string
  specialty: string
  ratingValue?: number
  reviewCount?: number
  qualifications?: string[]
  yearsExperience?: number
  languages?: string[]
  description?: string
  image: { src: string; alt: string }
  contactHref: string
  socialLinks?: ClinicDetailDoctorSocialLink[]
}

export type ClinicDetailTreatment = {
  id: string
  name: string
  priceFromUsd?: number
  category?: string
}

export type ClinicBeforeAfterEntry = {
  id: string
  title: string
  before: { src: string; alt: string }
  after: { src: string; alt: string }
  description?: string
  category?: string
  durationLabel?: string
}

export type ClinicDetailTrust = {
  ratingValue: number | null
  reviewCount: number
  verification: ClinicVerificationTier
  accreditations: string[]
  languages: string[]
}

export type ClinicDetailReview = {
  id: string
  reviewDate: string
  comment: string
  authorName?: string
  ratingValue: number
}

export type ClinicDetailReviews = {
  totalCount: number
  items: ClinicDetailReview[]
  hasMore?: boolean
}

export type ClinicDetailLocation = {
  fullAddress?: string
  coordinates?: { lat: number; lng: number }
  openStreetMapHref?: string
}

export type ClinicDetailContact = {
  phoneNumber?: string
  email?: string
  website?: string
}

export type ClinicDetailData = {
  clinicId: number
  clinicSlug: string
  clinicName: string
  heroImage: { src: string; alt: string }
  description: string
  trust: ClinicDetailTrust
  reviews: ClinicDetailReviews
  treatments: ClinicDetailTreatment[]
  doctors: ClinicDetailDoctor[]
  beforeAfterEntries: ClinicBeforeAfterEntry[]
  location: ClinicDetailLocation
  contact?: ClinicDetailContact
  contactHref: string
}

export type ClinicDetailConceptProps = {
  data: ClinicDetailData
  className?: string
  favorite?: {
    isPatient: boolean
    favoriteId?: number | null
    loginHref: string
  }
  cookieConsentConfig?: CookieConsentConfig | null
  cookieConsentInitialConsent?: CookieConsentState | null
}
