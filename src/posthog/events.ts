export type PostHogScalarProperty = string | number | boolean | null

export type PostHogSourceRoute = 'clinic_detail' | 'clinic_partners' | 'clinic_registration'

export type PostHogClinicVerificationTier = 'unverified' | 'bronze' | 'silver' | 'gold'

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
  clinic_inquiry_started: { clinic_id: string }
  clinic_search_result_viewed: { clinic_id: string }
  clinic_onboarding_interest_created: ClinicOnboardingInterestCreatedProperties
  clinic_profile_viewed: ClinicProfileViewedProperties
  register_clinic_submitted: RegisterClinicSubmittedProperties
}

export type PostHogEventName = keyof PostHogEventPropertiesByName

export type PostHogEventDefinition = {
  analysis: string
  allowedPropertyValues?: Readonly<Record<string, readonly string[]>>
  description: string
  optionalProperties: readonly string[]
  owner: string
  privacyNote: string
  requiredProperties: readonly string[]
  targetSystem: 'posthog'
  trigger: string
}

export const POSTHOG_EVENT_REGISTRY = {
  clinic_inquiry_started: {
    analysis: 'Distinct consent-eligible visitors starting a clinic inquiry per reporting window.',
    description: 'A visitor made their own substantive inquiry form change.',
    optionalProperties: [],
    owner: 'growth',
    privacyNote: 'Only clinic_id is allowed. No field values, medical selections, contact data or free text.',
    requiredProperties: ['clinic_id'],
    targetSystem: 'posthog',
    trigger:
      'Consent-eligible own substantive form edit, including invalid, incomplete or later cleared input. Opening, focus, scrolling, automatic or outside-form prefill and consent alone do not qualify.',
  },
  clinic_search_result_viewed: {
    analysis: 'Actual clinic search-result visibility.',
    description: 'A clinic result became visible in the active viewport.',
    optionalProperties: [],
    owner: 'growth',
    privacyNote: 'Only clinic_id is allowed. No search terms, medical selections or contact data.',
    requiredProperties: ['clinic_id'],
    targetSystem: 'posthog',
    trigger:
      'Consent-eligible result visible in the active viewport once per result-view instance, without a minimum duration or percentage threshold.',
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

const registeredReportingEvent = <Name extends PostHogEventName>(name: Name): Name => {
  if (!(name in POSTHOG_EVENT_REGISTRY)) {
    throw new Error(`Unknown PostHog reporting event: ${name}`)
  }

  return name
}

export const CLINIC_DASHBOARD_REPORTING_QUERY_CATALOG = Object.freeze({
  events: Object.freeze({
    profileViewed: registeredReportingEvent('clinic_profile_viewed'),
    inquiryStarted: registeredReportingEvent('clinic_inquiry_started'),
    searchResultViewed: registeredReportingEvent('clinic_search_result_viewed'),
  }),
})
