'use client'

import * as React from 'react'

import { ListingFilters } from '@/components/organisms/Listing'
import type { RatingFilterValue } from '@/components/molecules/RatingFilter'
import type { CheckboxOption } from '@/components/molecules/CheckboxGroup'

type ListingComparisonFilterValues = {
  cities: string[]
  waitTimes: Array<{ minWeeks: number; maxWeeks?: number }>
  treatments: string[]
  priceRange: [number, number]
  rating: RatingFilterValue
}

export type ListingComparisonFiltersProps = {
  cityOptions?: CheckboxOption[]
  waitTimeOptions?: Array<{ label: string; minWeeks: number; maxWeeks?: number }>
  treatmentOptions?: CheckboxOption[]
  initialValues?: ListingComparisonFilterValues
  onChange?: (filters: ListingComparisonFilterValues) => void
  debounceMs?: number
}

export function ListingComparisonFilters({
  cityOptions = [],
  waitTimeOptions = [],
  treatmentOptions = [],
  initialValues,
  onChange,
  debounceMs = 200,
}: ListingComparisonFiltersProps) {
  const [cities, setCities] = React.useState<string[]>(initialValues?.cities ?? [])
  const [waitTimes, setWaitTimes] = React.useState<string[]>(
    (initialValues?.waitTimes ?? []).flatMap((range) => {
      const match = waitTimeOptions.find((option) => option.minWeeks === range.minWeeks && option.maxWeeks === range.maxWeeks)
      return match ? [match.label] : []
    }),
  )
  const [treatments, setTreatments] = React.useState<string[]>(initialValues?.treatments ?? [])
  const [priceRange, setPriceRange] = React.useState<[number, number]>(initialValues?.priceRange ?? [0, 20000])
  const [rating, setRating] = React.useState<RatingFilterValue>(initialValues?.rating ?? null)

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
    <ListingFilters.Root
      defaultPriceRange={initialValues?.priceRange ?? [0, 20000]}
      defaultRating={initialValues?.rating ?? null}
      onPriceChange={setPriceRange}
      onRatingChange={setRating}
    >
      <ListingFilters.Price />

      {cityOptions.length > 0 ? (
        <ListingFilters.CheckboxGroup label="City" options={cityOptions} value={cities} onValueChange={setCities} />
      ) : null}

      {waitTimeOptions.length > 0 ? (
        <ListingFilters.CheckboxGroup
          label="Wait time"
          options={waitTimeOptions.map((opt) => ({ label: opt.label, value: opt.label }))}
          value={waitTimes}
          onValueChange={setWaitTimes}
        />
      ) : null}

      {treatmentOptions.length > 0 ? (
        <ListingFilters.CheckboxGroup
          label="Treatment"
          options={treatmentOptions}
          value={treatments}
          onValueChange={setTreatments}
        />
      ) : null}

      <ListingFilters.Rating />
    </ListingFilters.Root>
  )
}
