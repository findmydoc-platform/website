export type ContactFormFields = {
  fullName: string
  phoneNumber: string
  email: string
  preferredDate: string
  preferredTime: string
  note: string
}

export type BeforeAfterCaseGalleryEntry = {
  id: string
  title: string
  before: { src: string; alt: string }
  after: { src: string; alt: string }
  description?: string
  category?: string
  durationLabel?: string
}

export type BeforeAfterCaseGalleryVariant = 'spotlightQueue' | 'spotlightQueueReveal'

export type BeforeAfterCaseGalleryMetaConfig = {
  fallbackCategories?: readonly string[]
  fallbackDurations?: readonly string[]
}
