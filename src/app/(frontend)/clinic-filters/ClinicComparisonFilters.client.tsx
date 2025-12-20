'use client'

import * as React from 'react'

import { ClinicFilters } from '@/components/organisms/ClinicFilters'
import type { RatingFilterValue } from '@/components/molecules/RatingFilter'

export type ClinicComparisonFiltersProps = {
  cityOptions?: string[]
  waitTimeOptions?: Array<{ label: string; minWeeks: number; maxWeeks?: number }>
  treatmentOptions?: string[]
  onChange?: (filters: {
    cities: string[]
    waitTimes: Array<{ minWeeks: number; maxWeeks?: number }>
    treatments: string[]
    priceRange: [number, number]
    rating: RatingFilterValue
  }) => void
  debounceMs?: number
}

export function ClinicComparisonFilters({
  cityOptions = [],
  waitTimeOptions = [],
  treatmentOptions = [],
  onChange,
  debounceMs = 200,
}: ClinicComparisonFiltersProps) {
  const [cities, setCities] = React.useState<string[]>([])
  const [waitTimes, setWaitTimes] = React.useState<string[]>([])
  const [treatments, setTreatments] = React.useState<string[]>([])
  const [priceRange, setPriceRange] = React.useState<[number, number]>([0, 20000])
  const [rating, setRating] = React.useState<RatingFilterValue>(null)

  const waitTimeLookup = React.useMemo(() => {
    return new Map(waitTimeOptions.map((opt) => [opt.label, opt]))
  }, [waitTimeOptions])

  const onChangeRef = React.useRef<typeof onChange>(onChange)
  // Update ref synchronously during render (standard pattern for storing latest callback)
  onChangeRef.current = onChange

  React.useEffect(() => {
    if (!onChangeRef.current) return
    const ranges = waitTimes.flatMap((label) => {
      const opt = waitTimeLookup.get(label)
      return opt ? [{ minWeeks: opt.minWeeks, maxWeeks: opt.maxWeeks }] : []
    })

    const id = window.setTimeout(
      () =>
        onChangeRef.current?.({
          cities,
          waitTimes: ranges,
          treatments,
          priceRange,
          rating,
        }),
      debounceMs,
    )
    return () => window.clearTimeout(id)
  }, [cities, debounceMs, priceRange, rating, treatments, waitTimes, waitTimeLookup])

  return (
    <ClinicFilters.Root onPriceChange={setPriceRange} onRatingChange={setRating}>
      <ClinicFilters.Price />

      {cityOptions.length > 0 ? (
        <ClinicFilters.CheckboxGroup label="City" options={cityOptions} value={cities} onValueChange={setCities} />
      ) : null}

      {waitTimeOptions.length > 0 ? (
        <ClinicFilters.CheckboxGroup
          label="Wait time"
          options={waitTimeOptions.map((opt) => opt.label)}
          value={waitTimes}
          onValueChange={setWaitTimes}
        />
      ) : null}

      {treatmentOptions.length > 0 ? (
        <ClinicFilters.CheckboxGroup
          label="Treatment"
          options={treatmentOptions}
          value={treatments}
          onValueChange={setTreatments}
        />
      ) : null}

      <ClinicFilters.Rating />
    </ClinicFilters.Root>
  )
}
