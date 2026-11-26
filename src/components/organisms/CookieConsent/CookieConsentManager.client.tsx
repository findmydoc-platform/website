'use client'

import { useRef } from 'react'
import { createPortal } from 'react-dom'

import type { CookieConsentConfig, CookieConsentState } from '@/features/cookieConsent'
import { CookieConsentBanner } from './CookieConsentBanner.client'
import { CookieConsentDialog } from './CookieConsentDialog.client'
import { CookieConsentLauncher } from './CookieConsentLauncher.client'
import { useCookieConsentController } from './useCookieConsentController'

export type CookieConsentManagerProps = {
  config: CookieConsentConfig | null
  initialConsent: CookieConsentState | null
  deferInitialPrompt?: boolean
  launcherContainer?: HTMLElement | null
  onInitialPromptClose?: () => boolean
  onAnalyticsConsentChange: (enabled: boolean) => void
  onPersistConsent: (consent: CookieConsentState) => void
  readConsent: (expectedVersion: number) => CookieConsentState | null
}

export function CookieConsentManager({
  config,
  initialConsent,
  deferInitialPrompt = false,
  launcherContainer,
  onInitialPromptClose,
  onAnalyticsConsentChange,
  onPersistConsent,
  readConsent,
}: CookieConsentManagerProps) {
  const launcherRef = useRef<HTMLButtonElement>(null)
  const openedFromLauncher = useRef(false)
  const restoreLauncherFocus = () => launcherRef.current?.focus()
  const restoreInitialFocus = () => {
    if (!onInitialPromptClose?.()) restoreLauncherFocus()
  }
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

  const launcher =
    controller.isLauncherVisible || deferInitialPrompt ? (
      <CookieConsentLauncher
        buttonRef={launcherRef}
        ready={controller.isReady}
        label={config.reopenLabel}
        onOpenSettings={() => {
          openedFromLauncher.current = true
          controller.openSettings()
        }}
        inFlow={Boolean(launcherContainer)}
      />
    ) : null

  return (
    <>
      {controller.isBannerVisible && !deferInitialPrompt ? (
        <CookieConsentBanner
          ready={controller.isReady}
          onClose={restoreInitialFocus}
          config={config}
          onAcceptAll={() => controller.persistConsent('accepted', controller.acceptAllCategories)}
          onCustomize={() => {
            openedFromLauncher.current = false
            controller.openSettings()
          }}
          onRejectAll={() => controller.persistConsent('rejected', controller.rejectAllCategories)}
        />
      ) : null}

      {launcher && (launcherContainer ? createPortal(launcher, launcherContainer) : launcher)}
      <CookieConsentDialog
        open={controller.settingsOpen}
        onClose={() => {
          if (openedFromLauncher.current) restoreLauncherFocus()
          else restoreInitialFocus()
        }}
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
