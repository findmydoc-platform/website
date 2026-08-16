import type { BreadcrumbItem } from '@/components/molecules/Breadcrumb'
import type { CookieConsentConfig, CookieConsentState } from '@/features/cookieConsent'
import type { FreshnessSignals } from '@/utilities/freshness'

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
  priceFrom?: number
  category?: string
  comparisonLink?: {
    href: string
    label: string
  }
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

type ClinicDetailReviewBase = {
  id: string
  reviewDate: string
  authorName?: string
  ratingValue: number
}

export type ClinicDetailReview = ClinicDetailReviewBase &
  (
    | {
        kind: 'text'
        comment: string
        notice?: string
        response?: {
          body: string
          clinicName: string
          approvedAt: string
        }
      }
    | {
        kind: 'placeholder'
        notice: string
      }
  )

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

export type ClinicDetailGalleryImage = {
  id: string
  src: string
  alt: string
  caption?: string
}

export type ClinicDetailData = {
  clinicId: number
  clinicSlug: string
  clinicName: string
  breadcrumbs: BreadcrumbItem[]
  heroImage: { src: string; alt: string }
  galleryImages: ClinicDetailGalleryImage[]
  description: string
  trust: ClinicDetailTrust
  reviews: ClinicDetailReviews
  treatments: ClinicDetailTreatment[]
  doctors: ClinicDetailDoctor[]
  location: ClinicDetailLocation
  freshness: FreshnessSignals
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
