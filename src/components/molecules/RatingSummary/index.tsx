import * as React from 'react'
import { Star } from 'lucide-react'

import { cn } from '@/utilities/ui'

export type RatingStarsProps = {
  value: number
  className?: string
  emptyStarClassName?: string
  filledStarClassName?: string
  showValue?: boolean
  size?: 'sm' | 'lg'
  starClassName?: string
  valueClassName?: string
}

export function RatingStars({
  value,
  className,
  emptyStarClassName,
  filledStarClassName,
  showValue = false,
  size = 'sm',
  starClassName,
  valueClassName,
}: RatingStarsProps) {
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
            className={cn(
              size === 'lg' ? 'size-6 sm:size-7' : 'size-4',
              starClassName,
              isFilled
                ? (filledStarClassName ?? 'fill-primary text-primary')
                : (emptyStarClassName ?? 'fill-muted text-muted'),
            )}
            aria-hidden="true"
          />
        )
      })}
      {showValue ? (
        <span className={cn('ml-1 text-xs font-semibold text-primary', valueClassName)}>{clamped.toFixed(1)}</span>
      ) : null}
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
