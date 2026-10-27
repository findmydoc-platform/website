'use client'

import { usePathname } from 'next/navigation'

import type { CookieConsentConfig, CookieConsentState } from '@/features/cookieConsent'
import { CookieConsentBanner } from './CookieConsentBanner.client'
import { CookieConsentDialog } from './CookieConsentDialog.client'
import { CookieConsentLauncher } from './CookieConsentLauncher.client'
import { useCookieConsentController } from './useCookieConsentController'

export type CookieConsentManagerProps = {
  config: CookieConsentConfig | null
  initialConsent: CookieConsentState | null
  onAnalyticsConsentChange: (enabled: boolean) => void
  onPersistConsent: (consent: CookieConsentState) => void
  readConsent: (expectedVersion: number) => CookieConsentState | null
}

const compactBannerRoutes = new Set(['/login/patient', '/register/patient', '/register/clinic', '/admin/login'])

export function CookieConsentManager({
  config,
  initialConsent,
  onAnalyticsConsentChange,
  onPersistConsent,
  readConsent,
}: CookieConsentManagerProps) {
  const pathname = usePathname()
  const controller = useCookieConsentController({
    config,
    initialConsent,
    onAnalyticsConsentChange,
    onPersistConsent,
    readConsent,
  })
  const useCompactBanner = pathname ? compactBannerRoutes.has(pathname) : false

  if (!config?.enabled) {
    return null
  }

  return (
    <>
      {controller.isBannerVisible ? (
        <CookieConsentBanner
          compact={useCompactBanner}
          ready={controller.isReady}
          config={config}
          onAcceptAll={() => controller.persistConsent('accepted', controller.acceptAllCategories)}
          onCustomize={controller.openSettings}
          onRejectAll={() => controller.persistConsent('rejected', controller.rejectAllCategories)}
        />
      ) : null}

      {controller.isLauncherVisible ? (
        <CookieConsentLauncher
          compact={useCompactBanner}
          ready={controller.isReady}
          label={config.reopenLabel}
          onOpenSettings={controller.openSettings}
        />
      ) : null}

      <CookieConsentDialog
        open={controller.settingsOpen}
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
