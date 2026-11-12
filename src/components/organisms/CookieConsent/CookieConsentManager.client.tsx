'use client'

import { useRef } from 'react'

import type { CookieConsentConfig, CookieConsentState } from '@/features/cookieConsent'
import { CookieConsentBanner } from './CookieConsentBanner.client'
import { CookieConsentDialog } from './CookieConsentDialog.client'
import { CookieConsentLauncher } from './CookieConsentLauncher.client'
import { useCookieConsentController } from './useCookieConsentController'

export type CookieConsentManagerProps = {
  config: CookieConsentConfig | null
  initialConsent: CookieConsentState | null
  deferInitialPrompt?: boolean
  onAnalyticsConsentChange: (enabled: boolean) => void
  onPersistConsent: (consent: CookieConsentState) => void
  readConsent: (expectedVersion: number) => CookieConsentState | null
}

export function CookieConsentManager({
  config,
  initialConsent,
  deferInitialPrompt = false,
  onAnalyticsConsentChange,
  onPersistConsent,
  readConsent,
}: CookieConsentManagerProps) {
  const launcherRef = useRef<HTMLButtonElement>(null)
  const restoreLauncherFocus = () => launcherRef.current?.focus()
  const controller = useCookieConsentController({
    config,
    initialConsent,
    onAnalyticsConsentChange,
    onPersistConsent,
    readConsent,
  })

  if (!config?.enabled) {
    return null
  }

  return (
    <>
      {controller.isBannerVisible && !deferInitialPrompt ? (
        <CookieConsentBanner
          ready={controller.isReady}
          onClose={restoreLauncherFocus}
          config={config}
          onAcceptAll={() => controller.persistConsent('accepted', controller.acceptAllCategories)}
          onCustomize={controller.openSettings}
          onRejectAll={() => controller.persistConsent('rejected', controller.rejectAllCategories)}
        />
      ) : null}

      {controller.isLauncherVisible || deferInitialPrompt ? (
        <CookieConsentLauncher
          buttonRef={launcherRef}
          ready={controller.isReady}
          label={config.reopenLabel}
          onOpenSettings={controller.openSettings}
        />
      ) : null}

      <CookieConsentDialog
        open={controller.settingsOpen}
        onClose={restoreLauncherFocus}
        config={config}
        categoryDrafts={controller.categoryDrafts}
        onOpenChange={(open) => {
          if (open) {
            controller.openSettings()
            return
          }

          controller.closeSettings()
        }}
        onToggleCategory={controller.toggleCategory}
        onCancel={controller.closeSettings}
        onRejectAll={() => controller.persistConsent('rejected', controller.rejectAllCategories)}
        onSave={() => controller.persistConsent('customized', controller.categoryDrafts)}
      />
    </>
  )
}
