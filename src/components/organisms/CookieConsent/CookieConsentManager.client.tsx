'use client'

import type { CookieConsentConfig, CookieConsentState } from '@/features/cookieConsent'
import { CookieConsentBanner } from './CookieConsentBanner.client'
import { CookieConsentDialog } from './CookieConsentDialog.client'
import { CookieConsentLauncher } from './CookieConsentLauncher.client'
import { useCookieConsentController } from './useCookieConsentController'

type CookieConsentManagerProps = {
  config: CookieConsentConfig | null
  initialConsent: CookieConsentState | null
}

export function CookieConsentManager({ config, initialConsent }: CookieConsentManagerProps) {
  const controller = useCookieConsentController({
    config,
    initialConsent,
  })

  if (!config?.enabled) {
    return null
  }

  return (
    <>
      {controller.isBannerVisible ? (
        <CookieConsentBanner
          config={config}
          onAcceptAll={() => controller.persistConsent('accepted', controller.acceptAllCategories)}
          onCustomize={controller.openSettings}
          onRejectAll={() => controller.persistConsent('rejected', controller.rejectAllCategories)}
        />
      ) : null}

      {controller.isLauncherVisible ? (
        <CookieConsentLauncher label={config.reopenLabel} onOpenSettings={controller.openSettings} />
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
