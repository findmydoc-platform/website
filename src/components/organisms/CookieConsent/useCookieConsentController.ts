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
  isReady: boolean
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
  readConsent: (expectedVersion: number) => CookieConsentState | null
}

export function useCookieConsentController({
  config,
  initialConsent,
  onAnalyticsConsentChange,
  onPersistConsent,
  readConsent,
}: UseCookieConsentControllerOptions): CookieConsentController {
  const [clientState, setClientState] = React.useState<{
    version: number | undefined
    consent: CookieConsentState | null
  } | null>(null)
  const isReady = clientState !== null && clientState.version === config?.consentVersion
  const consent = clientState === null ? initialConsent : isReady ? clientState.consent : null
  const [categoryDrafts, setCategoryDrafts] = React.useState<CookieConsentCategoryMap>(() =>
    buildCategoryDraft(config?.categories ?? [], initialConsent?.categories),
  )
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const persistenceFailed = React.useRef(false)

  React.useEffect(() => {
    let currentConsent: CookieConsentState | null = null
    try {
      currentConsent = config?.enabled && !persistenceFailed.current ? readConsent(config.consentVersion) : null
    } catch {
      // Browser storage can be unavailable. Optional tools remain disabled.
    }
    setClientState({ version: config?.consentVersion, consent: currentConsent })
    setCategoryDrafts(buildCategoryDraft(config?.categories ?? [], currentConsent?.categories))
  }, [config?.categories, config?.consentVersion, config?.enabled, readConsent])

  React.useEffect(() => {
    // Reconcile storage before applying a decision, including when the manager remounts.
    if (clientState === null) return
    onAnalyticsConsentChange(isReady && isCookieConsentToolAllowed('posthog', config, consent?.categories))
  }, [clientState, config, consent, isReady, onAnalyticsConsentChange])

  const persistConsent = React.useCallback(
    (choice: CookieConsentState['choice'], categories: CookieConsentCategoryMap) => {
      if (!config?.enabled || !isReady) {
        return
      }

      const nextConsent = createCookieConsentState({
        choice,
        categories,
        version: config.consentVersion,
      })

      let persistedConsent: CookieConsentState | null = null
      try {
        onPersistConsent(nextConsent)
        const storedConsent = readConsent(config.consentVersion)
        if (JSON.stringify(storedConsent) === JSON.stringify(nextConsent)) {
          persistedConsent = storedConsent
        }
      } catch {
        // A failed write or read must not enable optional tools.
      }
      persistenceFailed.current = persistedConsent === null
      setClientState({ version: config.consentVersion, consent: persistedConsent })
      setCategoryDrafts(buildCategoryDraft(config.categories, persistedConsent?.categories))
      setSettingsOpen(false)
    },
    [config, isReady, onPersistConsent, readConsent],
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
    isReady,
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
