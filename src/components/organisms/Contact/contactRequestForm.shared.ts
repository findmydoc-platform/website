export type ContactRequestFormLabels = {
  emailPlaceholder: string
  emailRequiredMessage: string
  genericErrorMessage: string
  messagePlaceholder: string
  messageRequiredMessage: string
  namePlaceholder: string
  nameRequiredMessage: string
  submittingLabel: string
  successMessage: string
}

export type ContactFormContext = 'clinic_partner_landing' | 'clinic_profile_inquiry'
export type ContactSubmissionMetadata = Partial<Record<'clinic' | 'source', string>>

type ContactRequestContextPayload = ContactSubmissionMetadata & {
  form_context?: ContactFormContext
}

export type ContactRequestPayload = ContactRequestContextPayload &
  ({ email: string } | { name: string; email: string; message: string })

export type ContactRequestSubmitter = (
  targetSlug: string,
  payload: ContactRequestPayload,
  genericErrorMessage?: string,
) => Promise<void>

export const DEFAULT_CONTACT_FORM_SLUG = 'public-contact'

export const DEFAULT_CONTACT_FORM_LABELS: ContactRequestFormLabels = {
  emailPlaceholder: 'Email',
  emailRequiredMessage: 'Email is required.',
  genericErrorMessage: 'Could not send your request right now.',
  messagePlaceholder: 'Message',
  messageRequiredMessage: 'Message is required.',
  namePlaceholder: 'Name',
  nameRequiredMessage: 'Name is required.',
  submittingLabel: 'Sending...',
  successMessage: 'Your request has been sent successfully.',
}
