'use client'

import * as React from 'react'
import Link from 'next/link'
import { Cookie } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Checkbox } from '@/components/atoms/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/atoms/dialog'
import { Heading } from '@/components/atoms/Heading'
import { Label } from '@/components/atoms/label'
import { disablePostHog, enablePostHog } from '@/posthog/client-only'
import { cn } from '@/utilities/ui'
import {
  createCookieConsentState,
  type CookieConsentConfig,
  type CookieConsentState,
  writeCookieConsentToDocument,
} from '@/features/cookieConsent'

type CookieConsentManagerProps = {
  config: CookieConsentConfig | null
  initialConsent: CookieConsentState | null
}

function buildCategoryDraft(
  categories: CookieConsentConfig['categories'],
  source: CookieConsentState['categories'] | null | undefined,
  defaultValue = false,
): CookieConsentState['categories'] {
  return Object.fromEntries(categories.map((category) => [category.key, source?.[category.key] ?? defaultValue]))
}

export const CookieConsentManager: React.FC<CookieConsentManagerProps> = ({ config, initialConsent }) => {
  const [consent, setConsent] = React.useState<CookieConsentState | null>(initialConsent)
  const [categoryDrafts, setCategoryDrafts] = React.useState<CookieConsentState['categories']>(() =>
    buildCategoryDraft(config?.categories ?? [], initialConsent?.categories),
  )
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  React.useEffect(() => {
    setConsent(initialConsent)
    setCategoryDrafts(buildCategoryDraft(config?.categories ?? [], initialConsent?.categories))
  }, [config?.categories, initialConsent])

  React.useEffect(() => {
    if (!config?.enabled || !consent) {
      disablePostHog()
      return
    }

    if (consent.categories.analytics === true) {
      enablePostHog()
      return
    }

    disablePostHog()
  }, [config?.enabled, consent])

  const persistConsent = React.useCallback(
    (choice: CookieConsentState['choice'], categories: CookieConsentState['categories']) => {
      if (!config?.enabled) {
        return
      }

      const nextConsent = createCookieConsentState({
        choice,
        categories,
        version: config.consentVersion,
      })

      writeCookieConsentToDocument(nextConsent)
      setConsent(nextConsent)
      setCategoryDrafts(buildCategoryDraft(config.categories, nextConsent.categories))
      setSettingsOpen(false)
    },
    [config],
  )

  const openSettings = React.useCallback(() => {
    setCategoryDrafts(buildCategoryDraft(config?.categories ?? [], consent?.categories))
    setSettingsOpen(true)
  }, [config, consent])

  const acceptAllCategories = React.useMemo(
    () => buildCategoryDraft(config?.categories ?? [], undefined, true),
    [config],
  )

  const rejectAllCategories = React.useMemo(
    () => buildCategoryDraft(config?.categories ?? [], undefined, false),
    [config],
  )

  const isBannerVisible = Boolean(config?.enabled && !consent)
  const isLauncherVisible = Boolean(config?.enabled && consent)

  if (!config?.enabled) {
    return null
  }

  return (
    <>
      {isBannerVisible ? (
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-background/95 shadow-[0_30px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl">
              <div className="bg-linear-to-r from-primary/10 via-background to-accent/10 p-1">
                <div className="grid gap-6 rounded-[1.35rem] bg-background/95 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.4fr)_auto] lg:items-center">
                  <div className="space-y-3">
                    <Heading as="h2" align="left" size="h4" className="max-w-2xl">
                      {config.banner.title}
                    </Heading>
                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                      {config.banner.description}
                    </p>
                    <Link
                      className="inline-flex w-fit items-center rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-semibold tracking-wide text-primary transition-colors hover:border-primary/40 hover:bg-primary/5 hover:underline focus-visible:underline"
                      href={config.privacyPolicyHref}
                    >
                      {config.privacyPolicyLabel}
                    </Link>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
                    <Button
                      type="button"
                      variant="primary"
                      className="rounded-full px-6"
                      onClick={() => persistConsent('accepted', acceptAllCategories)}
                    >
                      {config.banner.acceptLabel}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-full px-6"
                      onClick={() => persistConsent('rejected', rejectAllCategories)}
                    >
                      {config.banner.rejectLabel}
                    </Button>
                    <Button type="button" variant="outline" className="rounded-full px-6" onClick={openSettings}>
                      {config.banner.customizeLabel}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isLauncherVisible ? (
        <div className="fixed right-4 bottom-4 z-50 sm:right-6 sm:bottom-6">
          <Button
            type="button"
            variant="outline"
            size="clear"
            aria-label={config.reopenLabel}
            className="group inline-flex h-11 w-11 items-center justify-start overflow-hidden rounded-full border border-border/80 bg-background/95 px-3 text-sm font-medium shadow-lg backdrop-blur-md transition-[width,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:w-[9.75rem] focus-visible:w-[9.75rem] sm:hover:w-[10.25rem] sm:focus-visible:w-[10.25rem]"
            onClick={openSettings}
          >
            <Cookie className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="pointer-events-none max-w-0 translate-x-2 overflow-hidden pl-0 text-left leading-none whitespace-nowrap opacity-0 transition-[max-width,opacity,transform,padding-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:max-w-[9rem] group-hover:translate-x-0 group-hover:pl-2 group-hover:opacity-100 group-focus-visible:max-w-[9rem] group-focus-visible:translate-x-0 group-focus-visible:pl-2 group-focus-visible:opacity-100 motion-reduce:transition-none">
              {config.reopenLabel}
            </span>
          </Button>
        </div>
      ) : null}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{config.settings.title}</DialogTitle>
            <DialogDescription>{config.settings.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <Checkbox checked disabled className="mt-1" />
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">{config.settings.essentialLabel}</Label>
                  <p className="text-sm text-muted-foreground">{config.settings.essentialDescription}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {config.categories.map((category, index) => {
                const checkboxId = `cookie-consent-category-${category.key}-${index}`
                const checked = categoryDrafts[category.key] ?? false

                return (
                  <div key={`${category.key}-${index}`} className="rounded-2xl border border-border/70 p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={checked}
                        id={checkboxId}
                        onCheckedChange={(nextChecked) => {
                          setCategoryDrafts((current) => ({
                            ...current,
                            [category.key]: nextChecked === true,
                          }))
                        }}
                        className="mt-1"
                      />
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold" htmlFor={checkboxId}>
                          {category.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">{category.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter className={cn('gap-3 sm:justify-between')}>
            <Button type="button" variant="ghost" onClick={() => setSettingsOpen(false)}>
              {config.settings.cancelLabel}
            </Button>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => persistConsent('rejected', rejectAllCategories)}>
                {config.banner.rejectLabel}
              </Button>
              <Button type="button" variant="primary" onClick={() => persistConsent('customized', categoryDrafts)}>
                {config.settings.saveLabel}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
