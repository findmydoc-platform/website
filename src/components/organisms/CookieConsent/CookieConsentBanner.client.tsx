'use client'

import { Button } from '@/components/atoms/button'
import { Heading } from '@/components/atoms/Heading'
import type { CookieConsentConfig } from '@/features/cookieConsent'

type CookieConsentBannerProps = {
  compact?: boolean
  config: CookieConsentConfig
  onAcceptAll: () => void
  onRejectAll: () => void
  onCustomize: () => void
}

export function CookieConsentBanner({
  compact = false,
  config,
  onAcceptAll,
  onRejectAll,
  onCustomize,
}: CookieConsentBannerProps) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 px-2.5 sm:px-6 sm:pt-4 sm:[padding-bottom:calc(env(safe-area-inset-bottom)+1rem)] lg:px-8 ${
        compact
          ? 'pt-1.5 [padding-bottom:calc(env(safe-area-inset-bottom)+0.25rem)]'
          : 'pt-2 [padding-bottom:calc(env(safe-area-inset-bottom)+0.625rem)]'
      }`}
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="max-h-[calc(100svh-0.75rem)] overflow-y-auto overscroll-contain rounded-3xl border border-border/70 bg-background/95 shadow-[0_30px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:max-h-none">
          <div className="bg-linear-to-r from-primary/10 via-background to-accent/10 p-1">
            {compact ? (
              <div className="rounded-[1.35rem] bg-background/95 p-2.5">
                <div className="space-y-2">
                  <Heading as="h2" align="left" size="h4" className="text-sm leading-tight sm:text-base">
                    {config.banner.title}
                  </Heading>
                  <p className="sr-only">{config.banner.description}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      className="h-9 w-full rounded-full px-2 text-[11px] whitespace-nowrap sm:text-sm"
                      onClick={onAcceptAll}
                    >
                      {config.banner.acceptLabel}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 w-full rounded-full px-2 text-[11px] whitespace-nowrap sm:text-sm"
                      onClick={onRejectAll}
                    >
                      {config.banner.rejectLabel}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-full rounded-full px-2 text-[11px] whitespace-nowrap sm:text-sm"
                      onClick={onCustomize}
                    >
                      {config.banner.customizeLabel}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 rounded-[1.35rem] bg-background/95 p-2.5 sm:gap-5 sm:p-6 lg:grid-cols-[minmax(0,1.4fr)_auto] lg:items-center">
                <div className="space-y-2 sm:space-y-3">
                  <Heading
                    as="h2"
                    align="left"
                    size="h4"
                    className="max-w-2xl text-base leading-tight sm:text-xl md:text-2xl lg:text-3xl"
                  >
                    {config.banner.title}
                  </Heading>
                  <p className="line-clamp-3 max-w-3xl text-xs leading-[1.35rem] text-muted-foreground sm:line-clamp-none sm:text-base sm:leading-6">
                    {config.banner.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:gap-3 lg:justify-end">
                  <Button
                    type="button"
                    variant="primary"
                    className="h-10 w-full rounded-full px-4 text-sm sm:h-10 sm:w-auto sm:px-6"
                    onClick={onAcceptAll}
                  >
                    {config.banner.acceptLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 w-full rounded-full px-4 text-sm sm:h-10 sm:w-auto sm:px-6"
                    onClick={onRejectAll}
                  >
                    {config.banner.rejectLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="col-span-2 h-9 w-full rounded-full px-4 text-sm sm:col-auto sm:h-10 sm:w-auto sm:px-6"
                    onClick={onCustomize}
                  >
                    {config.banner.customizeLabel}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
