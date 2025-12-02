'use client'

import { useState } from 'react'
import { Label } from '@/components/atoms/label'
import { Checkbox } from '@/components/atoms/checkbox'
import { Slider } from '@/components/atoms/slider'
import { RatingFilter, RatingFilterValue } from '@/components/molecules/RatingFilter'

export interface ClinicFiltersProps {
  cities?: string[]
  waitTimes?: string[]
  treatments?: string[]
}

const defaultCities = ['Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf']

const defaultWaitTimes = ['Bis 1 Woche', 'Bis 2 Wochen', 'Bis 4 Wochen', 'Über 4 Wochen']

const defaultTreatments = ['Hüftgelenk-OP', 'Kniegelenk-OP', 'Grauer Star OP', 'Zahnimplantat', 'Lasik Augen-OP']

export function ClinicFilters({
  cities = defaultCities,
  waitTimes = defaultWaitTimes,
  treatments = defaultTreatments,
}: ClinicFiltersProps) {
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 20000])
  const [selectedRating, setSelectedRating] = useState<RatingFilterValue>('Alle')

  return (
    <aside className="space-y-8 rounded-2xl bg-background p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Filter</h2>

      <section className="space-y-3">
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

      <section className="space-y-3">
        <Label className="text-base font-semibold">Stadt</Label>
        <div className="space-y-2">
          {cities.map((city) => (
            <label key={city} className="flex items-center gap-3 text-sm">
              <Checkbox />
              <span>{city}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <Label className="text-base font-semibold">Wartezeit</Label>
        <div className="space-y-2">
          {waitTimes.map((waitTime) => (
            <label key={waitTime} className="flex items-center gap-3 text-sm">
              <Checkbox />
              <span>{waitTime}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <Label className="text-base font-semibold">Behandlungsart</Label>
        <div className="space-y-2">
          {treatments.map((treatment) => (
            <label key={treatment} className="flex items-center gap-3 text-sm">
              <Checkbox />
              <span>{treatment}</span>
            </label>
          ))}
        </div>
      </section>

      <RatingFilter value={selectedRating} onChange={setSelectedRating} />
    </aside>
  )
}
