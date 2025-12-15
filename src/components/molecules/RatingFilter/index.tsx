'use client'

import { useState } from 'react'
import { Button } from '@/components/atoms/button'
import { Label } from '@/components/atoms/label'

const ratingOptions = ['Alle', '3+ ★', '4+ ★', '4.5+ ★'] as const

export type RatingFilterValue = (typeof ratingOptions)[number]

export interface RatingFilterProps {
  label?: string
  value?: RatingFilterValue
  onChange?: (value: RatingFilterValue) => void
}

export function RatingFilter({ label = 'Mindestbewertung', value, onChange }: RatingFilterProps) {
  const [internalValue, setInternalValue] = useState<RatingFilterValue>(value ?? 'Alle')

  const current = value ?? internalValue

  const handleSelect = (next: RatingFilterValue) => {
    setInternalValue(next)
    onChange?.(next)
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {ratingOptions.map((option) => (
          <Button
            key={option}
            type="button"
            size="xs"
            variant={option === current ? 'filter' : 'outline'}
            className="rounded-lg px-4"
            onClick={() => handleSelect(option)}
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  )
}
