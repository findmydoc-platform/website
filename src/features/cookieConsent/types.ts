export type CookieConsentChoice = 'accepted' | 'rejected' | 'customized'

export type CookieConsentCategoryConfig = {
  key: string
  label: string
  description: string
}

export type CookieConsentCategoryMap = Record<string, boolean>

export type CookieConsentState = {
  choice: CookieConsentChoice
  categories: CookieConsentCategoryMap
  version: number
  decidedAt: string
}

export type CookieConsentBannerContent = {
  title: string
  description: string
  acceptLabel: string
  rejectLabel: string
  customizeLabel: string
}

export type CookieConsentSettingsContent = {
  title: string
  description: string
  essentialLabel: string
  essentialDescription: string
  cancelLabel: string
  saveLabel: string
}

export type CookieConsentConfig = {
  enabled: boolean
  consentVersion: number
  banner: CookieConsentBannerContent
  settings: CookieConsentSettingsContent
  categories: CookieConsentCategoryConfig[]
  privacyPolicyLabel: string
  privacyPolicyHref: string
  reopenLabel: string
}
