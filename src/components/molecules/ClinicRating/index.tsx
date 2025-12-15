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

export function ClinicRating({ value, count, className }: { value: number; count: number; className?: string }) {
  return (
    <div className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <RatingStars value={value} className="gap-1" />
      <span className="font-medium text-muted-foreground text-sm">
        {value.toFixed(1)} ({count})
      </span>
    </div>
  )
}
