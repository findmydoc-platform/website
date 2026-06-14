'use client'

import * as React from 'react'
import { ChevronDown, Info } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card'
import { cn } from '@/utilities/ui'

export type DisclaimerNoticeVariant = 'inline-note' | 'slim-notice-bar' | 'collapsible-disclosure'
export type DisclaimerNoticeSurface = 'light' | 'muted'
export type DisclaimerNoticeSize = 'default' | 'compact'

export type DisclaimerNoticeProps = {
  copy: React.ReactNode
  variant?: DisclaimerNoticeVariant
  surface?: DisclaimerNoticeSurface
  size?: DisclaimerNoticeSize
  routeLabel?: string
  title?: string
  showVariantLabel?: boolean
  standalone?: boolean
  className?: string
}

function variantLabel(variant: DisclaimerNoticeVariant): string {
  switch (variant) {
    case 'inline-note':
      return 'Inline note'
    case 'slim-notice-bar':
      return 'Slim notice bar'
    case 'collapsible-disclosure':
      return 'Collapsible disclosure'
  }
}

function surfaceClasses(surface: DisclaimerNoticeSurface): string {
  return surface === 'muted' ? 'bg-muted/50' : 'bg-background'
}

function routeCardClasses(size: DisclaimerNoticeSize): string {
  return size === 'compact' ? 'p-4' : 'p-6'
}

export function DisclaimerNotice({
  copy,
  variant = 'inline-note',
  surface = 'light',
  size = 'default',
  routeLabel,
  title,
  showVariantLabel = true,
  standalone = false,
  className,
}: DisclaimerNoticeProps) {
  const [open, setOpen] = React.useState(false)
  const disclosureId = React.useId()
  const showBadge = typeof routeLabel === 'string' && routeLabel.trim().length > 0
  const showTitle = typeof title === 'string' && title.trim().length > 0

  if (standalone) {
    return (
      <aside
        aria-label={routeLabel ? `${routeLabel} disclaimer` : 'Disclaimer'}
        className={cn(
          'flex items-start gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3',
          variant === 'inline-note' ? 'border-l-2 border-l-primary/20' : null,
          className,
        )}
      >
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
          <Info className="size-4" aria-hidden={true} />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm leading-6 text-foreground">{copy}</p>
        </div>
      </aside>
    )
  }

  if (variant === 'collapsible-disclosure') {
    return (
      <div className={cn('rounded-2xl border border-border/60 bg-card px-4 py-3', className)}>
        <Button
          type="button"
          variant="ghost"
          size="clear"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-0 py-0 text-left text-sm font-medium text-foreground hover:bg-transparent"
          aria-expanded={open}
          aria-controls={disclosureId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="flex items-center gap-2">
            <Info className="size-4 text-primary/80" aria-hidden={true} />
            <span>{title ?? 'Why this note appears'}</span>
          </span>
          <ChevronDown className={cn('size-4 shrink-0 transition-transform', open ? 'rotate-180' : 'rotate-0')} />
        </Button>
        {showBadge || showVariantLabel || showTitle ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {showBadge ? (
              <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {routeLabel}
              </span>
            ) : null}
            {showVariantLabel ? (
              <span className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                {variantLabel(variant)}
              </span>
            ) : null}
          </div>
        ) : null}
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Short legal text stays available without taking over the page.
        </p>
        {open ? (
          <div id={disclosureId} className="mt-3 border-t border-border/60 pt-3 text-sm leading-6 text-foreground">
            {copy}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <Card className={cn('border-border/70 shadow-xs', surfaceClasses(surface), className)}>
      <CardHeader className={routeCardClasses(size)}>
        {showBadge || showVariantLabel ? (
          <div className="flex items-center gap-2">
            {showBadge ? (
              <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {routeLabel}
              </span>
            ) : null}
            {showVariantLabel ? (
              <span className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                {variantLabel(variant)}
              </span>
            ) : null}
          </div>
        ) : null}
        {showTitle ? <CardTitle className={cn(size === 'compact' ? 'text-base' : 'text-lg')}>{title}</CardTitle> : null}
        <CardDescription>
          {variant === 'slim-notice-bar'
            ? 'Still visible, but visually closer to a page utility than a prominent alert.'
            : 'Visible in flow, low-noise in tone, and short enough to keep the page feeling like content rather than a warning.'}
        </CardDescription>
      </CardHeader>
      <CardContent className={cn(routeCardClasses(size), 'pt-0')}>
        <aside
          aria-label={routeLabel ? `${routeLabel} disclaimer` : 'Disclaimer'}
          className={cn(
            'flex items-start gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3',
            variant === 'inline-note' ? 'border-l-2 border-l-primary/20' : null,
          )}
        >
          <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
            <Info className="size-4" aria-hidden={true} />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-sm leading-6 text-foreground">{copy}</p>
          </div>
        </aside>
      </CardContent>
    </Card>
  )
}
