'use client'

import { useEffect, useState, createContext, useContext, useRef } from 'react'
import { Label } from '@/components/atoms/label'
import { Slider } from '@/components/atoms/slider'
import { CheckboxGroup as CheckboxGroupMolecule } from '@/components/molecules/CheckboxGroup'
import { RatingFilter as RatingFilterMolecule, RatingFilterValue } from '@/components/molecules/RatingFilter'
import { cn } from '@/utilities/ui'

// 1. Context
type ListingFiltersContextType = {
  priceRange: [number, number]
  setPriceRange: (value: [number, number]) => void
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
  defaultRating?: RatingFilterValue
  onPriceChange?: (value: [number, number]) => void
  onRatingChange?: (value: RatingFilterValue) => void
}

const Root = ({
  children,
  className,
  defaultPriceRange = [0, 20000],
  defaultRating = null,
  onPriceChange,
  onRatingChange,
}: RootProps) => {
  const [priceRange, setPriceRange] = useState<[number, number]>(defaultPriceRange)
  const [selectedRating, setSelectedRating] = useState<RatingFilterValue>(defaultRating)

  const onPriceChangeRef = useRef<((value: [number, number]) => void) | undefined>(onPriceChange)
  const onRatingChangeRef = useRef<((value: RatingFilterValue) => void) | undefined>(onRatingChange)
  // Update refs synchronously during render (standard pattern for storing latest callback)
  onPriceChangeRef.current = onPriceChange
  onRatingChangeRef.current = onRatingChange

  const prevPriceRangeRef = useRef<[number, number]>(defaultPriceRange)
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
    <ListingFiltersContext.Provider value={{ priceRange, setPriceRange, selectedRating, setSelectedRating }}>
      <aside className={cn('bg-background space-y-8 rounded-2xl p-6 shadow-sm', className)}>
        <h2 className="text-xl font-semibold">Filter</h2>
        {children}
      </aside>
    </ListingFiltersContext.Provider>
  )
}

const Price = ({ className }: { className?: string }) => {
  const { priceRange, setPriceRange } = useListingFiltersContext()

  return (
    <section className={cn('space-y-3', className)}>
      <Label className="text-sm font-semibold">Price range</Label>
      <Slider
        min={0}
        max={20000}
        step={500}
        value={priceRange}
        onValueChange={(value: number[]) => {
          if (value.length === 2) {
            setPriceRange([value[0], value[1]] as [number, number])
          }
        }}
      />
      <div className="text-muted-foreground flex items-center justify-between text-sm font-medium">
        <span>{priceRange[0].toLocaleString('en-US')}€</span>
        <span>{priceRange[1].toLocaleString('en-US')}€</span>
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
