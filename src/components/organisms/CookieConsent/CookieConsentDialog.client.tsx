'use client'

import Link from 'next/link'

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
import { Label } from '@/components/atoms/label'
import type { CookieConsentCategoryKey, CookieConsentCategoryMap, CookieConsentConfig } from '@/features/cookieConsent'
import { cn } from '@/utilities/ui'

type CookieConsentDialogProps = {
  open: boolean
  config: CookieConsentConfig
  categoryDrafts: CookieConsentCategoryMap
  onOpenChange: (open: boolean) => void
  onToggleCategory: (key: CookieConsentCategoryKey, checked: boolean) => void
  onCancel: () => void
  onRejectAll: () => void
  onSave: () => void
}

export function CookieConsentDialog({
  open,
  config,
  categoryDrafts,
  onOpenChange,
  onToggleCategory,
  onCancel,
  onRejectAll,
  onSave,
}: CookieConsentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{config.settings.title}</DialogTitle>
          <DialogDescription>{config.settings.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {config.privacyPolicyHref ? (
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3">
              <div className="space-y-1">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Privacy policy</p>
                <p className="text-sm text-muted-foreground">
                  Read the page that explains how we handle optional cookies and third-party services.
                </p>
              </div>
              <Link
                className="inline-flex shrink-0 items-center rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-semibold tracking-wide text-primary transition-colors hover:border-primary/40 hover:bg-primary/5 hover:underline focus-visible:underline"
                href={config.privacyPolicyHref}
              >
                {config.privacyPolicyLabel}
              </Link>
            </div>
          ) : null}

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
            {config.categories.map((category) => {
              const checkboxId = `cookie-consent-category-${category.key}`
              const checked = categoryDrafts[category.key] ?? false

              return (
                <div key={category.key} className="rounded-2xl border border-border/70 p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={checked}
                      id={checkboxId}
                      onCheckedChange={(nextChecked) => {
                        onToggleCategory(category.key, nextChecked === true)
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
          <Button type="button" variant="ghost" onClick={onCancel}>
            {config.settings.cancelLabel}
          </Button>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button type="button" variant="outline" onClick={onRejectAll}>
              {config.banner.rejectLabel}
            </Button>
            <Button type="button" variant="primary" onClick={onSave}>
              {config.settings.saveLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
