'use client'

import { Button } from '@/components/atoms/button'
import { Heading } from '@/components/atoms/Heading'
import type { CookieConsentConfig } from '@/features/cookieConsent'

type CookieConsentBannerProps = {
  config: CookieConsentConfig
  onAcceptAll: () => void
  onRejectAll: () => void
  onCustomize: () => void
}

export function CookieConsentBanner({ config, onAcceptAll, onRejectAll, onCustomize }: CookieConsentBannerProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pt-3 [padding-bottom:calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-6 sm:pt-4 sm:[padding-bottom:calc(env(safe-area-inset-bottom)+1rem)] lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="max-h-[calc(100svh-0.75rem)] overflow-y-auto overscroll-contain rounded-3xl border border-border/70 bg-background/95 shadow-[0_30px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:max-h-none">
          <div className="bg-linear-to-r from-primary/10 via-background to-accent/10 p-1">
            <div className="grid gap-4 rounded-[1.35rem] bg-background/95 p-3 sm:gap-5 sm:p-6 lg:grid-cols-[minmax(0,1.4fr)_auto] lg:items-center">
              <div className="space-y-2.5 sm:space-y-3">
                <Heading
                  as="h2"
                  align="left"
                  size="h4"
                  className="max-w-2xl text-lg sm:text-xl md:text-2xl lg:text-3xl"
                >
                  {config.banner.title}
                </Heading>
                <p className="max-w-3xl text-[13px] leading-5 text-muted-foreground sm:text-base sm:leading-6">
                  {config.banner.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:flex-wrap sm:gap-3 lg:justify-end">
                <Button
                  type="button"
                  variant="primary"
                  className="h-11 w-full rounded-full px-4 sm:h-10 sm:w-auto sm:px-6"
                  onClick={onAcceptAll}
                >
                  {config.banner.acceptLabel}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 w-full rounded-full px-4 sm:h-10 sm:w-auto sm:px-6"
                  onClick={onRejectAll}
                >
                  {config.banner.rejectLabel}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="col-span-2 h-11 w-full rounded-full px-4 sm:col-auto sm:h-10 sm:w-auto sm:px-6"
                  onClick={onCustomize}
                >
                  {config.banner.customizeLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
