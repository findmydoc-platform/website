'use client'

import * as React from 'react'

import {
  createCookieConsentState,
  isCookieConsentToolAllowed,
  type CookieConsentCategoryKey,
  type CookieConsentCategoryMap,
  type CookieConsentConfig,
  type CookieConsentState,
} from '@/features/cookieConsent'

function buildCategoryDraft(
  categories: CookieConsentConfig['categories'],
  source: CookieConsentState['categories'] | null | undefined,
  defaultValue = false,
): CookieConsentCategoryMap {
  return Object.fromEntries(categories.map((category) => [category.key, source?.[category.key] ?? defaultValue]))
}

export type CookieConsentController = {
  consent: CookieConsentState | null
  categoryDrafts: CookieConsentCategoryMap
  settingsOpen: boolean
  isBannerVisible: boolean
  isLauncherVisible: boolean
  acceptAllCategories: CookieConsentCategoryMap
  rejectAllCategories: CookieConsentCategoryMap
  openSettings: () => void
  closeSettings: () => void
  toggleCategory: (key: CookieConsentCategoryKey, checked: boolean) => void
  persistConsent: (choice: CookieConsentState['choice'], categories: CookieConsentCategoryMap) => void
}

type UseCookieConsentControllerOptions = {
  config: CookieConsentConfig | null
  initialConsent: CookieConsentState | null
  onAnalyticsConsentChange: (enabled: boolean) => void
  onPersistConsent: (consent: CookieConsentState) => void
}

export function useCookieConsentController({
  config,
  initialConsent,
  onAnalyticsConsentChange,
  onPersistConsent,
}: UseCookieConsentControllerOptions): CookieConsentController {
  const [consent, setConsent] = React.useState<CookieConsentState | null>(initialConsent)
  const [categoryDrafts, setCategoryDrafts] = React.useState<CookieConsentCategoryMap>(() =>
    buildCategoryDraft(config?.categories ?? [], initialConsent?.categories),
  )
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  React.useEffect(() => {
    setConsent(initialConsent)
    setCategoryDrafts(buildCategoryDraft(config?.categories ?? [], initialConsent?.categories))
  }, [config?.categories, initialConsent])

  React.useEffect(() => {
    onAnalyticsConsentChange(isCookieConsentToolAllowed('posthog', config, consent?.categories))
  }, [config, consent, onAnalyticsConsentChange])

  const persistConsent = React.useCallback(
    (choice: CookieConsentState['choice'], categories: CookieConsentCategoryMap) => {
      if (!config?.enabled) {
        return
      }

      const nextConsent = createCookieConsentState({
        choice,
        categories,
        version: config.consentVersion,
      })

      onPersistConsent(nextConsent)
      setConsent(nextConsent)
      setCategoryDrafts(buildCategoryDraft(config.categories, nextConsent.categories))
      setSettingsOpen(false)
    },
    [config, onPersistConsent],
  )

  const openSettings = React.useCallback(() => {
    setCategoryDrafts(buildCategoryDraft(config?.categories ?? [], consent?.categories))
    setSettingsOpen(true)
  }, [config, consent])

  const closeSettings = React.useCallback(() => {
    setSettingsOpen(false)
  }, [])

  const toggleCategory = React.useCallback((key: CookieConsentCategoryKey, checked: boolean) => {
    setCategoryDrafts((current) => ({
      ...current,
      [key]: checked,
    }))
  }, [])

  const acceptAllCategories = React.useMemo(
    () => buildCategoryDraft(config?.categories ?? [], undefined, true),
    [config],
  )

  const rejectAllCategories = React.useMemo(
    () => buildCategoryDraft(config?.categories ?? [], undefined, false),
    [config],
  )

  return {
    consent,
    categoryDrafts,
    settingsOpen,
    isBannerVisible: Boolean(config?.enabled && !consent),
    isLauncherVisible: Boolean(config?.enabled && consent),
    acceptAllCategories,
    rejectAllCategories,
    openSettings,
    closeSettings,
    toggleCategory,
    persistConsent,
  }
}
