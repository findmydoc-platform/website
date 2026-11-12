'use client'

import { useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/atoms/dialog'
import { UiLink } from '@/components/molecules/Link'
import type { CookieConsentConfig } from '@/features/cookieConsent'

type CookieConsentBannerProps = {
  onClose?: () => void
  ready: boolean
  config: CookieConsentConfig
  onAcceptAll: () => void
  onRejectAll: () => void
  onCustomize: () => void
}

export function CookieConsentBanner({
  ready,
  config,
  onAcceptAll,
  onRejectAll,
  onCustomize,
  onClose,
}: CookieConsentBannerProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [settingsHovered, setSettingsHovered] = useState(false)
  const [settingsFocused, setSettingsFocused] = useState(false)
  const [tooltipDismissed, setTooltipDismissed] = useState(false)
  const showTooltip = !tooltipDismissed && (settingsHovered || settingsFocused)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && ready) onRejectAll()
      }}
    >
      <DialogContent
        aria-modal="true"
        overlayClassName="bg-black/50 backdrop-blur-xs"
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[62.5rem] gap-0 overflow-y-auto overscroll-contain rounded-3xl p-6 sm:p-8 lg:p-10"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          titleRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onClose?.()
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (showTooltip) {
            event.preventDefault()
            setTooltipDismissed(true)
          } else if (!ready) event.preventDefault()
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-start gap-x-4 gap-y-6 lg:grid-cols-[14rem_minmax(0,1fr)_2.75rem] lg:gap-x-8">
          <div className="col-span-2 pr-8 lg:col-span-1 lg:row-span-2 lg:pr-0">
            <DialogTitle
              ref={titleRef}
              tabIndex={-1}
              className="text-left text-[1.625rem] leading-tight font-bold break-words text-secondary focus-visible:outline-none sm:text-3xl lg:text-4xl"
            >
              {config.banner.title}
            </DialogTitle>
            <div aria-hidden="true" className="mt-4 w-12 rounded-full border-b-4 border-accent" />
          </div>

          <DialogDescription className="col-span-2 text-base leading-6 whitespace-pre-line text-foreground lg:col-start-2 lg:row-start-1">
            {config.banner.description}
          </DialogDescription>

          <div className="col-start-1 row-start-3 flex min-h-11 flex-wrap items-center gap-x-6 gap-y-3 lg:col-span-2 lg:col-start-2 lg:row-start-2 lg:min-h-0">
            {config.privacyPolicyHref ? (
              <UiLink
                href={config.privacyPolicyHref}
                newTab
                className="w-fit text-sm text-foreground underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {config.privacyPolicyLabel}
                <span className="sr-only"> (opens in a new tab)</span>
              </UiLink>
            ) : null}
            {config.imprintLink ? (
              <UiLink
                {...config.imprintLink}
                newTab
                className="w-fit text-sm text-foreground underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="sr-only"> (opens in a new tab)</span>
              </UiLink>
            ) : null}
          </div>

          <div
            className="relative col-start-2 row-start-3 justify-self-end lg:col-start-3 lg:row-start-4 lg:self-center"
            onPointerEnter={() => {
              setSettingsHovered(true)
              setTooltipDismissed(false)
            }}
            onPointerLeave={() => setSettingsHovered(false)}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={config.banner.customizeLabel}
              className="size-11 rounded-lg text-foreground hover:bg-muted"
              disabled={!ready}
              onClick={onCustomize}
              onFocus={() => {
                setSettingsFocused(true)
                setTooltipDismissed(false)
              }}
              onBlur={() => setSettingsFocused(false)}
            >
              <Settings2 aria-hidden="true" className="size-6 -scale-x-100" />
            </Button>
            {showTooltip && (
              <span className="absolute right-0 bottom-full z-10 pb-2">
                <span role="tooltip" className="block max-w-48 rounded-md bg-secondary px-2 py-1 text-xs text-white">
                  {config.banner.customizeLabel}
                </span>
              </span>
            )}
          </div>

          <div
            aria-hidden="true"
            className="col-span-2 row-start-4 border-t border-border lg:col-span-3 lg:row-start-3"
          />

          <div className="col-span-2 row-start-5 grid grid-cols-1 gap-3 lg:row-start-4 lg:grid-cols-2 lg:gap-6">
            <Button
              type="button"
              variant="primary"
              className="h-auto min-h-12 w-full rounded-lg whitespace-normal"
              disabled={!ready}
              onClick={onAcceptAll}
            >
              {config.banner.acceptLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-12 w-full rounded-lg whitespace-normal text-secondary"
              disabled={!ready}
              onClick={onRejectAll}
            >
              {config.banner.rejectLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
