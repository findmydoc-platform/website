'use client'

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
import type { CookieConsentCategoryMap, CookieConsentConfig } from '@/features/cookieConsent'
import { cn } from '@/utilities/ui'

type CookieConsentDialogProps = {
  open: boolean
  config: CookieConsentConfig
  categoryDrafts: CookieConsentCategoryMap
  onOpenChange: (open: boolean) => void
  onToggleCategory: (key: string, checked: boolean) => void
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
