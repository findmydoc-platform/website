import type { CookieConsentConfig, CookieConsentState } from '@/features/cookieConsent'
import type { PatientInquiryCreationContext } from '@/features/patientInquiries/creationContext'
import type { FreshnessSignals } from '@/utilities/freshness'

export type ClinicVerificationTier = 'unverified' | 'bronze' | 'silver' | 'gold'

export type ClinicDetailBreadcrumbItem = {
  label: string
  href: string
  current?: boolean
}

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
  breadcrumbs: ClinicDetailBreadcrumbItem[]
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

export type ClinicContactRequestPayload = {
  clinicId: string
  doctorId?: string
  treatmentId?: string
  idempotencyKey: string
  treatmentTimeline?: string
  preferredContactWindow?: string
  message: string
  consent: boolean
  email?: string
  fullName?: string
  phoneNumber?: string
}

export type ClinicContactRequestSubmitter = (
  payload: ClinicContactRequestPayload,
  authenticated: boolean,
) => Promise<{ id: string }>

export type ClinicDetailProfileViewedEvent = {
  clinicId: string
  clinicSlug: string
  hasDoctors: boolean
  hasTreatments: boolean
  pagePath: string
  verificationTier: ClinicVerificationTier
}

export type ClinicDetailCtaClickedEvent = {
  clinicId: string
  clinicSlug: string
  ctaId: 'choose_treatment' | 'contact' | 'contact_doctor'
  ctaLabel: string
  ctaLocation: 'doctor_card' | 'further_treatments' | 'location_card' | 'map_overlay' | 'treatment_strip'
  doctorId?: string
  pagePath: string
  treatmentId?: string
}

export type ClinicDetailAnalyticsPort = {
  onCtaClicked: (event: ClinicDetailCtaClickedEvent) => void
  onProfileViewed: (event: ClinicDetailProfileViewedEvent) => void
}

export class ClinicContactRequestError extends Error {
  constructor(
    message: string,
    readonly requiresReauthentication: boolean,
  ) {
    super(message)
    this.name = 'ClinicContactRequestError'
  }
}

export type ClinicDetailConceptProps = {
  data: ClinicDetailData
  className?: string
  favorite?: {
    isPatient: boolean
    favoriteId?: number | null
    loginHref: string
  }
  inquiryCreation?: PatientInquiryCreationContext
  analytics: ClinicDetailAnalyticsPort
  onSubmitContactRequest: ClinicContactRequestSubmitter
  cookieConsentConfig?: CookieConsentConfig | null
  cookieConsentInitialConsent?: CookieConsentState | null
}
