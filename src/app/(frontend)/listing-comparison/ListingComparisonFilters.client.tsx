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

type ListingComparisonPriceBounds = {
  min: number
  max: number
}

function normalizePriceBounds(bounds?: ListingComparisonPriceBounds): ListingComparisonPriceBounds {
  const min = typeof bounds?.min === 'number' && Number.isFinite(bounds.min) ? Math.max(bounds.min, 0) : 0
  const maxCandidate = typeof bounds?.max === 'number' && Number.isFinite(bounds.max) ? bounds.max : 20000
  const max = Math.max(maxCandidate, min)

  return { min, max }
}

function clampPriceRange(priceRange: [number, number], bounds: ListingComparisonPriceBounds): [number, number] {
  const minCandidate = Number.isFinite(priceRange[0]) ? priceRange[0] : bounds.min
  const maxCandidate = Number.isFinite(priceRange[1]) ? priceRange[1] : bounds.max
  const lower = Math.min(Math.max(minCandidate, bounds.min), bounds.max)
  const upper = Math.max(lower, Math.min(Math.max(maxCandidate, lower), bounds.max))
  return [lower, upper]
}

export type ListingComparisonFiltersProps = {
  cityOptions?: CheckboxOption[]
  waitTimeOptions?: Array<{ label: string; minWeeks: number; maxWeeks?: number }>
  treatmentOptions?: CheckboxOption[]
  priceBounds?: ListingComparisonPriceBounds
  initialValues?: ListingComparisonFilterValues
  onChange?: (filters: ListingComparisonFilterValues) => void
  debounceMs?: number
}

export function ListingComparisonFilters({
  cityOptions = [],
  waitTimeOptions = [],
  treatmentOptions = [],
  priceBounds,
  initialValues,
  onChange,
  debounceMs = 200,
}: ListingComparisonFiltersProps) {
  const normalizedPriceBounds = React.useMemo(() => normalizePriceBounds(priceBounds), [priceBounds])
  const runtimePriceBounds = React.useMemo(
    () => ({
      min: normalizedPriceBounds.min,
      max: normalizedPriceBounds.max,
    }),
    [normalizedPriceBounds.max, normalizedPriceBounds.min],
  )
  const initialPriceRange = clampPriceRange(
    initialValues?.priceRange ?? [runtimePriceBounds.min, runtimePriceBounds.max],
    runtimePriceBounds,
  )

  const [cities, setCities] = React.useState<string[]>(initialValues?.cities ?? [])
  const [waitTimes, setWaitTimes] = React.useState<string[]>(
    (initialValues?.waitTimes ?? []).flatMap((range) => {
      const match = waitTimeOptions.find(
        (option) => option.minWeeks === range.minWeeks && option.maxWeeks === range.maxWeeks,
      )
      return match ? [match.label] : []
    }),
  )
  const [treatments, setTreatments] = React.useState<string[]>(initialValues?.treatments ?? [])
  const [priceRange, setPriceRange] = React.useState<[number, number]>(initialPriceRange)
  const [rating, setRating] = React.useState<RatingFilterValue>(initialValues?.rating ?? null)

  const waitTimeLookup = React.useMemo(() => {
    return new Map(waitTimeOptions.map((opt) => [opt.label, opt]))
  }, [waitTimeOptions])

  const onChangeRef = React.useRef<typeof onChange>(onChange)
  // Update ref synchronously during render (standard pattern for storing latest callback)
  onChangeRef.current = onChange

  React.useEffect(() => {
    setPriceRange((currentRange) => clampPriceRange(currentRange, runtimePriceBounds))
  }, [runtimePriceBounds])

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
          priceRange: clampPriceRange(priceRange, runtimePriceBounds),
          rating,
        }),
      debounceMs,
    )
    return () => window.clearTimeout(id)
  }, [cities, debounceMs, priceRange, rating, runtimePriceBounds, treatments, waitTimes, waitTimeLookup])

  return (
    <ListingFilters.Root
      defaultPriceRange={initialPriceRange}
      priceBounds={runtimePriceBounds}
      defaultRating={initialValues?.rating ?? null}
      onPriceChange={(nextRange) => setPriceRange(clampPriceRange(nextRange, runtimePriceBounds))}
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
