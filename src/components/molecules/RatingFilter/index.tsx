'use client'

import { useState } from 'react'
import { Button } from '@/components/atoms/button'
import { Label } from '@/components/atoms/label'

export type RatingFilterValue = number | null

const ratingOptions: Array<{ label: string; value: RatingFilterValue }> = [
  { label: 'All', value: null },
  { label: '4.5+ ★', value: 4.5 },
  { label: '4+ ★', value: 4 },
  { label: '3+ ★', value: 3 },
]

export interface RatingFilterProps {
  label?: string
  defaultValue?: RatingFilterValue
  value?: RatingFilterValue
  onChange?: (value: RatingFilterValue) => void
}

export function RatingFilter({ label = 'Minimum rating', defaultValue = null, value, onChange }: RatingFilterProps) {
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
            key={option.label}
            type="button"
            size="xs"
            variant={option.value === current ? 'filter' : 'outline'}
            className="rounded-lg px-4"
            onClick={() => handleSelect(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
