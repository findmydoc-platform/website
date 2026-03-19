export type HoldingPageContactFormLabels = {
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

export const DEFAULT_CONTACT_FORM_SLUG = 'holding-contact'

export const DEFAULT_CONTACT_FORM_LABELS: HoldingPageContactFormLabels = {
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
