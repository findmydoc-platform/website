'use client'

import { useRef } from 'react'

import { Button } from '@/components/atoms/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/atoms/dialog'
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

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && ready) onRejectAll()
      }}
    >
      <DialogContent
        aria-modal="true"
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto overscroll-contain rounded-2xl p-5 sm:p-6"
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
          if (!ready) event.preventDefault()
        }}
      >
        <DialogHeader className="space-y-4 text-left">
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="pr-8 text-xl leading-tight focus-visible:outline-none sm:text-2xl"
          >
            {config.banner.title}
          </DialogTitle>
          <DialogDescription className="text-base leading-6 whitespace-pre-line">
            {config.banner.description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="primary"
            className="h-auto min-h-11 w-full rounded-full whitespace-normal"
            disabled={!ready}
            onClick={onAcceptAll}
          >
            {config.banner.acceptLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-11 w-full rounded-full whitespace-normal"
            disabled={!ready}
            onClick={onRejectAll}
          >
            {config.banner.rejectLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-11 w-full rounded-full whitespace-normal sm:col-span-2"
            disabled={!ready}
            onClick={onCustomize}
          >
            {config.banner.customizeLabel}
          </Button>
        </div>

        {config.privacyPolicyHref ? (
          <UiLink
            href={config.privacyPolicyHref}
            newTab
            className="w-fit text-sm text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {config.privacyPolicyLabel}
            <span className="sr-only"> (opens in a new tab)</span>
          </UiLink>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
