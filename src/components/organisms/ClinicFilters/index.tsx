'use client'

import { useEffect, useState, createContext, useContext } from 'react'
import { Label } from '@/components/atoms/label'
import { Slider } from '@/components/atoms/slider'
import { CheckboxGroup as CheckboxGroupMolecule } from '@/components/molecules/CheckboxGroup'
import { RatingFilter as RatingFilterMolecule, RatingFilterValue } from '@/components/molecules/RatingFilter'
import { cn } from '@/utilities/ui'

// 1. Context
type ClinicFiltersContextType = {
  priceRange: [number, number]
  setPriceRange: (value: [number, number]) => void
  selectedRating: RatingFilterValue
  setSelectedRating: (value: RatingFilterValue) => void
}

const ClinicFiltersContext = createContext<ClinicFiltersContextType | null>(null)

const useClinicFiltersContext = () => {
  const context = useContext(ClinicFiltersContext)
  if (!context) {
    throw new Error('useClinicFiltersContext must be used within ClinicFilters.Root')
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

  useEffect(() => {
    onPriceChange?.(priceRange)
  }, [onPriceChange, priceRange])

  useEffect(() => {
    onRatingChange?.(selectedRating)
  }, [onRatingChange, selectedRating])

  return (
    <ClinicFiltersContext.Provider value={{ priceRange, setPriceRange, selectedRating, setSelectedRating }}>
      <aside className={cn('space-y-8 rounded-2xl bg-background p-6 shadow-sm', className)}>
        <h2 className="text-xl font-semibold">Filter</h2>
        {children}
      </aside>
    </ClinicFiltersContext.Provider>
  )
}

const Price = ({ className }: { className?: string }) => {
  const { priceRange, setPriceRange } = useClinicFiltersContext()

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
      <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
        <span>{priceRange[0].toLocaleString('en-US')}€</span>
        <span>{priceRange[1].toLocaleString('en-US')}€</span>
      </div>
    </section>
  )
}

const CheckboxGroup = CheckboxGroupMolecule

const Rating = ({ className }: { className?: string }) => {
  const { selectedRating, setSelectedRating } = useClinicFiltersContext()

  return (
    <div className={className}>
      <RatingFilterMolecule value={selectedRating} onChange={setSelectedRating} />
    </div>
  )
}

// 3. Namespace Export
export const ClinicFilters = {
  Root,
  Price,
  CheckboxGroup,
  Rating,
}
