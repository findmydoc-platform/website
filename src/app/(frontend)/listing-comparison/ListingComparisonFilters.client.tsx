'use client'

import * as React from 'react'

import { ListingFilters } from '@/components/organisms/Listing'
import type { RatingFilterValue } from '@/components/molecules/RatingFilter'
import type { CheckboxOption } from '@/components/molecules/CheckboxGroup'
import { clampPriceRange, normalizePriceBounds, type PriceBounds } from '@/utilities/listingComparison/priceRange'

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
  priceBounds?: PriceBounds
  initialValues?: ListingComparisonFilterValues
  onChange?: (filters: ListingComparisonFilterValues) => void
}

export function ListingComparisonFilters({
  cityOptions = [],
  waitTimeOptions = [],
  treatmentOptions = [],
  priceBounds,
  initialValues,
  onChange,
}: ListingComparisonFiltersProps) {
  const normalizedPriceBounds = React.useMemo(() => normalizePriceBounds(priceBounds), [priceBounds])
  const activePriceBounds = React.useMemo(
    () => ({
      min: normalizedPriceBounds.min,
      max: normalizedPriceBounds.max,
    }),
    [normalizedPriceBounds.max, normalizedPriceBounds.min],
  )
  const initialPriceRange = clampPriceRange(
    initialValues?.priceRange ?? [activePriceBounds.min, activePriceBounds.max],
    activePriceBounds,
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

  const waitTimeByLabel = React.useMemo(() => {
    return new Map(waitTimeOptions.map((opt) => [opt.label, opt]))
  }, [waitTimeOptions])

  const onChangeRef = React.useRef<typeof onChange>(onChange)
  // Update ref synchronously during render (standard pattern for storing latest callback)
  onChangeRef.current = onChange

  React.useEffect(() => {
    setPriceRange((currentRange) => clampPriceRange(currentRange, activePriceBounds))
  }, [activePriceBounds])

  React.useEffect(() => {
    if (!onChangeRef.current) return
    const ranges = waitTimes.flatMap((label) => {
      const opt = waitTimeByLabel.get(label)
      return opt ? [{ minWeeks: opt.minWeeks, maxWeeks: opt.maxWeeks }] : []
    })

    onChangeRef.current({
      cities,
      waitTimes: ranges,
      treatments,
      priceRange,
      rating,
    })
  }, [cities, priceRange, rating, treatments, waitTimes, waitTimeByLabel])

  return (
    <ListingFilters.Root
      defaultPriceRange={initialPriceRange}
      priceBounds={activePriceBounds}
      defaultRating={initialValues?.rating ?? null}
      onPriceChange={(nextRange) => setPriceRange(clampPriceRange(nextRange, activePriceBounds))}
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
