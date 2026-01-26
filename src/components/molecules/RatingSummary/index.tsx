import * as React from 'react'
import { Star } from 'lucide-react'

import { cn } from '@/utilities/ui'

function RatingStars({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(5, value))
  const filled = Math.round(clamped)

  return (
    <div
      className={cn('inline-flex items-center gap-1', className)}
      aria-label={`Rating ${clamped.toFixed(1)} out of 5`}
      role="img"
    >
      {Array.from({ length: 5 }).map((_, idx) => {
        const isFilled = idx < filled
        return (
          <Star
            key={idx}
            className={cn('size-4', isFilled ? 'fill-primary text-primary' : 'fill-muted text-muted')}
            aria-hidden="true"
          />
        )
      })}
    </div>
  )
}

export type RatingSummaryVariant = 'inline' | 'stacked'
export type RatingSummaryCountFormat = 'paren' | 'reviews'

export type RatingSummaryProps = {
  value: number
  count: number
  className?: string
  variant?: RatingSummaryVariant
  countFormat?: RatingSummaryCountFormat
}

function formatCount(count: number, format: RatingSummaryCountFormat) {
  return format === 'reviews' ? `${count} Reviews` : `(${count})`
}

export function RatingSummary({
  value,
  count,
  className,
  variant = 'inline',
  countFormat = 'paren',
}: RatingSummaryProps) {
  const valueText = value.toFixed(1)
  const countText = formatCount(count, countFormat)

  if (variant === 'stacked') {
    return (
      <div className={cn('flex flex-col items-end text-right', className)}>
        <div className="flex items-center justify-end gap-2">
          <RatingStars value={value} className="justify-end gap-1" />
          <div className="text-xs text-secondary/60">{valueText}/5</div>
        </div>
        <div className="mt-0.5 text-xs text-secondary/60">{countText}</div>
      </div>
    )
  }

  return (
    <div className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <RatingStars value={value} className="gap-1" />
      <span className="text-sm font-medium text-muted-foreground">
        {valueText} {countText}
      </span>
    </div>
  )
}
