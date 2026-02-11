'use client'

import { useEffect, useMemo, useState, createContext, useContext, useRef } from 'react'
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
  defaultPriceRange?: [number, number]
  priceBounds?: PriceBounds
  priceStep?: number
  defaultRating?: RatingFilterValue
  onPriceChange?: (value: [number, number]) => void
  onRatingChange?: (value: RatingFilterValue) => void
}

const Root = ({
  children,
  className,
  defaultPriceRange = [0, 20000],
  priceBounds,
  priceStep = DEFAULT_PRICE_STEP,
  defaultRating = null,
  onPriceChange,
  onRatingChange,
}: RootProps) => {
  const normalizedPriceBounds = useMemo(() => normalizePriceBounds(priceBounds, DEFAULT_PRICE_BOUNDS), [priceBounds])
  const normalizedPriceStep = Number.isFinite(priceStep) && priceStep > 0 ? priceStep : DEFAULT_PRICE_STEP
  const normalizedDefaultPriceRange = useMemo(
    () => clampPriceRange(defaultPriceRange, normalizedPriceBounds),
    [defaultPriceRange, normalizedPriceBounds],
  )

  const [priceRange, setPriceRange] = useState<[number, number]>(normalizedDefaultPriceRange)
  const [selectedRating, setSelectedRating] = useState<RatingFilterValue>(defaultRating)

  const onPriceChangeRef = useRef<((value: [number, number]) => void) | undefined>(onPriceChange)
  const onRatingChangeRef = useRef<((value: RatingFilterValue) => void) | undefined>(onRatingChange)
  // Update refs synchronously during render (standard pattern for storing latest callback)
  onPriceChangeRef.current = onPriceChange
  onRatingChangeRef.current = onRatingChange

  useEffect(() => {
    setPriceRange((current) => {
      const next = clampPriceRange(current, normalizedPriceBounds)
      if (next[0] === current[0] && next[1] === current[1]) {
        return current
      }
      return next
    })
  }, [normalizedPriceBounds])

  const prevPriceRangeRef = useRef<[number, number]>(normalizedDefaultPriceRange)
  useEffect(() => {
    const prev = prevPriceRangeRef.current
    if (prev[0] !== priceRange[0] || prev[1] !== priceRange[1]) {
      onPriceChangeRef.current?.(priceRange)
      prevPriceRangeRef.current = priceRange
    }
  }, [priceRange])

  const prevSelectedRatingRef = useRef<RatingFilterValue>(defaultRating)
  useEffect(() => {
    const prev = prevSelectedRatingRef.current
    if (prev !== selectedRating) {
      onRatingChangeRef.current?.(selectedRating)
      prevSelectedRatingRef.current = selectedRating
    }
  }, [selectedRating])

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
