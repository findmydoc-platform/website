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
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pt-4 [padding-bottom:calc(env(safe-area-inset-bottom)+1rem)] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="max-h-[calc(100svh-1rem)] overflow-y-auto overscroll-contain rounded-3xl border border-border/70 bg-background/95 shadow-[0_30px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:max-h-none">
          <div className="bg-linear-to-r from-primary/10 via-background to-accent/10 p-1">
            <div className="grid gap-5 rounded-[1.35rem] bg-background/95 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.4fr)_auto] lg:items-center">
              <div className="space-y-3">
                <Heading as="h2" align="left" size="h4" className="max-w-2xl">
                  {config.banner.title}
                </Heading>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {config.banner.description}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
                <Button
                  type="button"
                  variant="primary"
                  className="w-full rounded-full px-6 sm:w-auto"
                  onClick={onAcceptAll}
                >
                  {config.banner.acceptLabel}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full rounded-full px-6 sm:w-auto"
                  onClick={onRejectAll}
                >
                  {config.banner.rejectLabel}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full px-6 sm:w-auto"
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
