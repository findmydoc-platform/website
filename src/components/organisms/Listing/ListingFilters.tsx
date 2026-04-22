'use client'

import { useCallback, useEffect, useMemo, useState, createContext, useContext } from 'react'
import { Heading } from '@/components/atoms/Heading'
import { Label } from '@/components/atoms/label'
import { Slider } from '@/components/atoms/slider'
import { CheckboxGroup as CheckboxGroupMolecule } from '@/components/molecules/CheckboxGroup'
import { RatingFilter as RatingFilterMolecule, RatingFilterValue } from '@/components/molecules/RatingFilter'
import {
  clampPriceRange,
  DEFAULT_PRICE_BOUNDS,
  normalizePriceBounds,
  type PriceBounds,
} from '@/utilities/listingComparison/priceRange'
import { cn } from '@/utilities/ui'

const DEFAULT_PRICE_STEP = 500

const isSamePriceRange = (left: [number, number], right: [number, number]): boolean =>
  left[0] === right[0] && left[1] === right[1]

export type ListingFiltersValue = {
  priceRange: [number, number]
  rating: RatingFilterValue
}

// 1. Context
type ListingFiltersContextType = {
  priceRange: [number, number]
  setPriceRange: (value: [number, number]) => void
  priceBounds: PriceBounds
  priceStep: number
  selectedRating: RatingFilterValue
  setSelectedRating: (value: RatingFilterValue) => void
}

const ListingFiltersContext = createContext<ListingFiltersContextType | null>(null)

const useListingFiltersContext = () => {
  const context = useContext(ListingFiltersContext)
  if (!context) {
    throw new Error('useListingFiltersContext must be used within ListingFilters.Root')
  }
  return context
}

// 2. Sub-components
type RootProps = {
  children: React.ReactNode
  className?: string
  value?: Partial<ListingFiltersValue>
  defaultValue?: Partial<ListingFiltersValue>
  defaultPriceRange?: [number, number]
  priceBounds?: PriceBounds
  priceStep?: number
  defaultRating?: RatingFilterValue
  onPriceChange?: (value: [number, number]) => void
  onRatingChange?: (value: RatingFilterValue) => void
  onValueChange?: (value: ListingFiltersValue) => void
}

const Root = ({
  children,
  className,
  value,
  defaultValue,
  defaultPriceRange = [0, 20000],
  priceBounds,
  priceStep = DEFAULT_PRICE_STEP,
  defaultRating = null,
  onPriceChange,
  onRatingChange,
  onValueChange,
}: RootProps) => {
  const normalizedPriceBounds = useMemo(() => normalizePriceBounds(priceBounds, DEFAULT_PRICE_BOUNDS), [priceBounds])
  const normalizedPriceStep = Number.isFinite(priceStep) && priceStep > 0 ? priceStep : DEFAULT_PRICE_STEP
  const normalizedDefaultPriceRange = useMemo(
    () => clampPriceRange(defaultValue?.priceRange ?? defaultPriceRange, normalizedPriceBounds),
    [defaultPriceRange, defaultValue, normalizedPriceBounds],
  )
  const normalizedDefaultRating = defaultValue?.rating ?? defaultRating

  const [uncontrolledPriceRange, setUncontrolledPriceRange] = useState<[number, number]>(normalizedDefaultPriceRange)
  const [uncontrolledRating, setUncontrolledRating] = useState<RatingFilterValue>(normalizedDefaultRating)
  const isPriceControlled = value?.priceRange !== undefined
  const isRatingControlled = value?.rating !== undefined

  const priceRange = useMemo(
    () =>
      clampPriceRange(
        (isPriceControlled ? value?.priceRange : uncontrolledPriceRange) ?? normalizedDefaultPriceRange,
        normalizedPriceBounds,
      ),
    [isPriceControlled, normalizedDefaultPriceRange, normalizedPriceBounds, uncontrolledPriceRange, value?.priceRange],
  )
  const selectedRating = isRatingControlled ? (value?.rating ?? null) : uncontrolledRating

  useEffect(() => {
    if (isPriceControlled) return

    setUncontrolledPriceRange((current) => {
      const next = clampPriceRange(current, normalizedPriceBounds)
      if (isSamePriceRange(next, current)) {
        return current
      }

      return next
    })
  }, [isPriceControlled, normalizedPriceBounds])

  const emitValueChange = useCallback(
    (nextPriceRange: [number, number], nextRating: RatingFilterValue) => {
      onPriceChange?.(nextPriceRange)
      onRatingChange?.(nextRating)
      onValueChange?.({
        priceRange: nextPriceRange,
        rating: nextRating,
      })
    },
    [onPriceChange, onRatingChange, onValueChange],
  )

  const setPriceRange = useCallback(
    (nextPriceRange: [number, number]) => {
      const clampedRange = clampPriceRange(nextPriceRange, normalizedPriceBounds)

      if (isSamePriceRange(priceRange, clampedRange)) {
        return
      }

      if (!isPriceControlled) {
        setUncontrolledPriceRange(clampedRange)
      }

      emitValueChange(clampedRange, selectedRating)
    },
    [emitValueChange, isPriceControlled, normalizedPriceBounds, priceRange, selectedRating],
  )

  const setSelectedRating = useCallback(
    (nextRating: RatingFilterValue) => {
      if (selectedRating === nextRating) {
        return
      }

      if (!isRatingControlled) {
        setUncontrolledRating(nextRating)
      }

      emitValueChange(priceRange, nextRating)
    },
    [emitValueChange, isRatingControlled, priceRange, selectedRating],
  )

  return (
    <ListingFiltersContext.Provider
      value={{
        priceRange,
        setPriceRange,
        priceBounds: normalizedPriceBounds,
        priceStep: normalizedPriceStep,
        selectedRating,
        setSelectedRating,
      }}
    >
      <aside className={cn('space-y-8 rounded-2xl bg-background p-6 shadow-sm', className)}>
        <Heading as="h2" align="left" size="h5" className="font-semibold">
          Filter
        </Heading>
        {children}
      </aside>
    </ListingFiltersContext.Provider>
  )
}

const Price = ({ className, min, max, step }: { className?: string; min?: number; max?: number; step?: number }) => {
  const { priceRange, setPriceRange, priceBounds, priceStep } = useListingFiltersContext()
  const resolvedMin = typeof min === 'number' && Number.isFinite(min) ? Math.max(min, 0) : priceBounds.min
  const resolvedMaxInput = typeof max === 'number' && Number.isFinite(max) ? max : priceBounds.max
  const resolvedMax = Math.max(resolvedMaxInput, resolvedMin)
  const resolvedStep = typeof step === 'number' && Number.isFinite(step) && step > 0 ? step : priceStep

  const displayedRange = clampPriceRange(priceRange, { min: resolvedMin, max: resolvedMax })

  useEffect(() => {
    if (displayedRange[0] === priceRange[0] && displayedRange[1] === priceRange[1]) return
    setPriceRange(displayedRange)
  }, [displayedRange, priceRange, setPriceRange])

  return (
    <section className={cn('space-y-3', className)}>
      <Label className="text-sm font-semibold">Price range</Label>
      <Slider
        min={resolvedMin}
        max={resolvedMax}
        step={resolvedStep}
        value={displayedRange}
        onValueChange={(value: number[]) => {
          if (value.length === 2) {
            setPriceRange(
              clampPriceRange([value[0], value[1]] as [number, number], { min: resolvedMin, max: resolvedMax }),
            )
          }
        }}
      />
      <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
        <span>{displayedRange[0].toLocaleString('en-US')}€</span>
        <span>{displayedRange[1].toLocaleString('en-US')}€</span>
      </div>
    </section>
  )
}

const CheckboxGroup = CheckboxGroupMolecule

const Rating = ({ className }: { className?: string }) => {
  const { selectedRating, setSelectedRating } = useListingFiltersContext()

  return (
    <div className={className}>
      <RatingFilterMolecule value={selectedRating} onChange={setSelectedRating} />
    </div>
  )
}

// 3. Namespace Export
export const ListingFilters = {
  Root,
  Price,
  CheckboxGroup,
  Rating,
}
