'use client'

import { useState } from 'react'
import { Button } from '@/components/atoms/button'
import { Label } from '@/components/atoms/label'

export type RatingFilterValue = number | null

const ratingOptions: RatingFilterValue[] = [null, 4.5, 4, 3]

export interface RatingFilterProps {
  label?: string
  allLabel?: string
  locale?: string
  defaultValue?: RatingFilterValue
  value?: RatingFilterValue
  onChange?: (value: RatingFilterValue) => void
}

export function RatingFilter({
  label = 'Minimum rating',
  allLabel = 'All',
  locale = 'en',
  defaultValue = null,
  value,
  onChange,
}: RatingFilterProps) {
  const [internalValue, setInternalValue] = useState<RatingFilterValue>(defaultValue)
  const isControlled = value !== undefined

  const current = isControlled ? value : internalValue

  const handleSelect = (next: RatingFilterValue) => {
    if (!isControlled) {
      setInternalValue(next)
    }
    onChange?.(next)
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {ratingOptions.map((option) => (
          <Button
            key={String(option)}
            type="button"
            size="xs"
            variant={option === current ? 'filter' : 'outline'}
            aria-pressed={option === current}
            className="rounded-lg px-4"
            onClick={() => handleSelect(option)}
          >
            {option === null ? allLabel : `${option.toLocaleString(locale)}+ ★`}
          </Button>
        ))}
      </div>
    </div>
  )
}
