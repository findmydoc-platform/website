export type ClinicVerificationTier = 'unverified' | 'bronze' | 'silver' | 'gold'

export type ClinicDetailDoctorSocialLink = {
  kind: 'facebook' | 'linkedin' | 'twitter'
  href: string
  label: string
}

export type ClinicDetailDoctor = {
  id: string
  name: string
  specialty: string
  ratingValue?: number
  reviewCount?: number
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
}

export type ClinicDetailTrust = {
  ratingValue?: number
  reviewCount?: number
  verification: ClinicVerificationTier
  accreditations: string[]
  languages: string[]
}

export type ClinicDetailLocation = {
  fullAddress?: string
  coordinates?: { lat: number; lng: number }
  openStreetMapHref?: string
}

export type ClinicDetailData = {
  clinicSlug: string
  clinicName: string
  heroImage: { src: string; alt: string }
  description: string
  trust: ClinicDetailTrust
  treatments: ClinicDetailTreatment[]
  doctors: ClinicDetailDoctor[]
  beforeAfterEntries: ClinicBeforeAfterEntry[]
  location: ClinicDetailLocation
  contactHref: string
}

export type ClinicDetailConceptProps = {
  data: ClinicDetailData
  className?: string
}
