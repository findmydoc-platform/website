export type PostHogScalarProperty = string | number | boolean | null

export type PostHogSourceRoute = 'clinic_detail' | 'clinic_partners' | 'clinic_registration'

export type PostHogClinicVerificationTier = 'unverified' | 'bronze' | 'silver' | 'gold'

export type ClinicCtaId = 'choose_treatment' | 'contact' | 'contact_doctor'

export type ClinicCtaLocation =
  | 'doctor_card'
  | 'further_treatments'
  | 'location_card'
  | 'map_overlay'
  | 'treatment_strip'

export type RegisterClinicSubmissionStatus = 'created' | 'deduped'

export type ClinicProfileViewedProperties = {
  clinic_id: string
  clinic_slug: string
  has_doctors?: boolean
  has_treatments?: boolean
  page_path: string
  source_route: Extract<PostHogSourceRoute, 'clinic_detail'>
  verification_tier?: PostHogClinicVerificationTier
}

export type ClinicCtaClickedProperties = {
  clinic_id: string
  clinic_slug: string
  cta_id: ClinicCtaId
  cta_label: string
  cta_location: ClinicCtaLocation
  doctor_id?: string
  page_path: string
  source_route: Extract<PostHogSourceRoute, 'clinic_detail'>
  treatment_id?: string
}

export type PatientInquiryCreatedProperties = {
  clinic_id: string
  clinic_slug: string
  doctor_id?: string
  form_slug: string
  has_doctor?: boolean
  has_message?: boolean
  has_preferred_date?: boolean
  has_preferred_time?: boolean
  has_treatment?: boolean
  source_route: Extract<PostHogSourceRoute, 'clinic_detail'>
  submission_id?: string
  treatment_id?: string
}

export type ClinicOnboardingInterestCreatedProperties = {
  form_slug: string
  has_message?: boolean
  page_path: string
  source_route: Extract<PostHogSourceRoute, 'clinic_partners'>
  submission_id?: string
}

export type RegisterClinicSubmittedProperties = {
  medical_specialty_count?: number
  source_route: Extract<PostHogSourceRoute, 'clinic_registration'>
  submission_status: RegisterClinicSubmissionStatus
}

export type PostHogEventPropertiesByName = {
  clinic_cta_clicked: ClinicCtaClickedProperties
  clinic_onboarding_interest_created: ClinicOnboardingInterestCreatedProperties
  clinic_profile_viewed: ClinicProfileViewedProperties
  patient_inquiry_created: PatientInquiryCreatedProperties
  register_clinic_submitted: RegisterClinicSubmittedProperties
}

export type PostHogEventName = keyof PostHogEventPropertiesByName

export type PostHogEventDefinition = {
  analysis: string
  description: string
  optionalProperties: readonly string[]
  owner: string
  privacyNote: string
  requiredProperties: readonly string[]
  targetSystem: 'posthog'
  trigger: string
}

export const POSTHOG_EVENT_REGISTRY = {
  clinic_cta_clicked: {
    analysis: 'Clinic profile CTA engagement and contact intent funnel analysis.',
    description: 'A visitor clicked a tracked clinic profile call to action.',
    optionalProperties: ['doctor_id', 'treatment_id'],
    owner: 'growth',
    privacyNote: 'No contact details, medical free text, or raw message content are allowed.',
    requiredProperties: [
      'clinic_id',
      'clinic_slug',
      'cta_id',
      'cta_label',
      'cta_location',
      'page_path',
      'source_route',
    ],
    targetSystem: 'posthog',
    trigger: 'Captured in the browser after a consent-eligible clinic profile CTA click.',
  },
  clinic_onboarding_interest_created: {
    analysis: 'Clinic partner landing conversion analysis.',
    description: 'A clinic partner contact request was accepted by the form bridge.',
    optionalProperties: ['has_message', 'submission_id'],
    owner: 'growth',
    privacyNote: 'No contact details or submitted message content are allowed.',
    requiredProperties: ['form_slug', 'page_path', 'source_route'],
    targetSystem: 'posthog',
    trigger: 'Captured on the server only after a clinic partner contact form submission succeeds.',
  },
  clinic_profile_viewed: {
    analysis: 'Clinic profile reach and entry-volume analysis.',
    description: 'A visitor viewed a public clinic profile.',
    optionalProperties: ['has_doctors', 'has_treatments', 'verification_tier'],
    owner: 'growth',
    privacyNote: 'Only clinic identifiers and profile metadata are allowed.',
    requiredProperties: ['clinic_id', 'clinic_slug', 'page_path', 'source_route'],
    targetSystem: 'posthog',
    trigger: 'Captured in the browser after a consent-eligible public clinic profile view.',
  },
  patient_inquiry_created: {
    analysis: 'Clinic profile inquiry conversion analysis.',
    description: 'A patient contact request was accepted by the form bridge.',
    optionalProperties: [
      'doctor_id',
      'has_doctor',
      'has_message',
      'has_preferred_date',
      'has_preferred_time',
      'has_treatment',
      'submission_id',
      'treatment_id',
    ],
    owner: 'growth',
    privacyNote:
      'No patient name, email, phone number, appointment date/time, medical free text, or raw message content are allowed.',
    requiredProperties: ['clinic_id', 'clinic_slug', 'form_slug', 'source_route'],
    targetSystem: 'posthog',
    trigger: 'Captured on the server only after a clinic profile contact form submission succeeds.',
  },
  register_clinic_submitted: {
    analysis: 'Clinic registration submission and duplicate-submission analysis.',
    description: 'A clinic registration application was submitted or deduplicated.',
    optionalProperties: ['medical_specialty_count'],
    owner: 'growth',
    privacyNote:
      'No clinic contact person, email, phone number, street address, or additional notes content are allowed.',
    requiredProperties: ['source_route', 'submission_status'],
    targetSystem: 'posthog',
    trigger: 'Captured on the server after a clinic application create or dedupe succeeds.',
  },
} as const satisfies Record<PostHogEventName, PostHogEventDefinition>
