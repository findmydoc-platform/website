'use client'

import * as React from 'react'
import { ChevronDown, Info } from 'lucide-react'

import { Button } from '@/components/atoms/button'
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
  return surface === 'muted' ? 'bg-muted/45' : 'bg-card'
}

function noticePaddingClasses(size: DisclaimerNoticeSize, standalone: boolean): string {
  if (standalone) {
    return size === 'compact' ? 'py-2.5' : 'py-3'
  }

  return size === 'compact' ? 'px-3.5 py-3' : 'px-4 py-3.5'
}

function noticeVariantClasses(variant: DisclaimerNoticeVariant, standalone: boolean): string {
  if (standalone && variant !== 'collapsible-disclosure') {
    return 'rounded-none border-0 bg-transparent shadow-none'
  }

  switch (variant) {
    case 'inline-note':
      return 'border-l-2 border-l-primary/30'
    case 'slim-notice-bar':
      return 'border-border/60'
    case 'collapsible-disclosure':
      return 'border-border/60'
  }
}

function iconClasses(size: DisclaimerNoticeSize, standalone: boolean): string {
  if (standalone) {
    return size === 'compact' ? 'size-5' : 'size-6'
  }

  return size === 'compact' ? 'size-6' : 'size-7'
}

export function DisclaimerNotice({
  copy,
  variant = 'inline-note',
  surface = 'light',
  size = 'default',
  routeLabel,
  title,
  showVariantLabel = false,
  standalone = false,
  className,
}: DisclaimerNoticeProps) {
  const [open, setOpen] = React.useState(false)
  const disclosureId = React.useId()
  const showBadge = typeof routeLabel === 'string' && routeLabel.trim().length > 0
  const showTitle = typeof title === 'string' && title.trim().length > 0

  if (variant === 'collapsible-disclosure') {
    return (
      <div
        className={cn(
          'rounded-xl border shadow-xs',
          surfaceClasses(surface),
          noticeVariantClasses(variant, standalone),
          noticePaddingClasses(size, standalone),
          className,
        )}
      >
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
            <span>{title ?? routeLabel ?? 'Information note'}</span>
          </span>
          <ChevronDown className={cn('size-4 shrink-0 transition-transform', open ? 'rotate-180' : 'rotate-0')} />
        </Button>
        {!standalone && (showBadge || showVariantLabel) ? (
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
        {open ? (
          <div id={disclosureId} className="mt-3 border-t border-border/60 pt-3 text-sm leading-6 text-foreground">
            {copy}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <aside
      aria-label={routeLabel ? `${routeLabel} disclaimer` : 'Disclaimer'}
      className={cn(
        'flex items-start gap-3 rounded-xl border border-border/60 shadow-xs',
        surfaceClasses(surface),
        noticePaddingClasses(size, standalone),
        noticeVariantClasses(variant, standalone),
        className,
      )}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary',
          iconClasses(size, standalone),
        )}
      >
        <Info className={cn(size === 'compact' || standalone ? 'size-3.5' : 'size-4')} aria-hidden={true} />
      </span>
      <div className="min-w-0 space-y-1">
        {!standalone && (showBadge || showVariantLabel || showTitle) ? (
          <div className="flex flex-wrap items-center gap-2">
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
            {showTitle ? <span className="text-xs font-semibold text-foreground">{title}</span> : null}
          </div>
        ) : null}
        <p className={cn('text-sm leading-6', standalone ? 'text-muted-foreground' : 'text-foreground')}>{copy}</p>
      </div>
    </aside>
  )
}
