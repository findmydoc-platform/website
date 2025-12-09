'use client'

import { useState, createContext, useContext } from 'react'
import { Label } from '@/components/atoms/label'
import { Checkbox } from '@/components/atoms/checkbox'
import { Slider } from '@/components/atoms/slider'
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
const Root = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 20000])
  const [selectedRating, setSelectedRating] = useState<RatingFilterValue>('Alle')

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
      <Label className="text-base font-semibold">Preisbereich</Label>
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
        <span>{priceRange[0].toLocaleString('de-DE')}€</span>
        <span>{priceRange[1].toLocaleString('de-DE')}€</span>
      </div>
    </section>
  )
}

const CheckboxGroup = ({
  label,
  options,
  className,
  value = [],
  onValueChange,
}: {
  label: string
  options: string[]
  className?: string
  value?: string[]
  onValueChange?: (value: string[]) => void
}) => {
  return (
    <section className={cn('space-y-3', className)}>
      <Label className="text-base font-semibold">{label}</Label>
      <div className="space-y-2">
        {options.map((option) => {
          const isChecked = value.includes(option)
          return (
            <label key={option} className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => {
                  if (!onValueChange) return
                  if (checked) {
                    onValueChange([...value, option])
                  } else {
                    onValueChange(value.filter((v) => v !== option))
                  }
                }}
              />
              <span>{option}</span>
            </label>
          )
        })}
      </div>
    </section>
  )
}

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
