'use client'

import * as React from 'react'
import { Award, BadgeCheck, Shield, Users } from 'lucide-react'

import type { ListingCardData } from '@/components/organisms/Listing'
import { ListingComparison } from '@/components/templates/ListingComparison/Component'
import { ListingComparisonFilters } from './ListingComparisonFilters.client'

type FilterState = {
  cities: string[]
  waitTimes: Array<{ minWeeks: number; maxWeeks?: number }>
  treatments: string[]
  priceRange: [number, number]
  rating: number | null
}

const applyFilters = (list: ListingCardData[], filters: FilterState) => {
  return list.filter((clinic) => {
    const cityMatch =
      filters.cities.length === 0 ||
      filters.cities.some((city) => clinic.location?.toLowerCase().includes(city.toLowerCase()))

    const treatmentMatch =
      filters.treatments.length === 0 ||
      filters.treatments.some((treatment) =>
        clinic.tags?.some((tag) => tag.toLowerCase().includes(treatment.toLowerCase())),
      )

    const waitTimeMatch = (() => {
      if (filters.waitTimes.length === 0 || !clinic.waitTime) return true
      const numeric = parseFloat(clinic.waitTime)
      if (Number.isNaN(numeric)) return true
      return filters.waitTimes.some((range) => {
        const minOk = numeric >= range.minWeeks
        const maxOk = range.maxWeeks === undefined ? true : numeric <= range.maxWeeks
        return minOk && maxOk
      })
    })()

    const priceMatch = (() => {
      const price = clinic.priceFrom?.value
      if (!price) return true
      return price >= filters.priceRange[0] && price <= filters.priceRange[1]
    })()

    const ratingMatch = (() => {
      if (filters.rating === null) return true
      const value = clinic.rating?.value ?? 0
      return value >= filters.rating
    })()

    return cityMatch && treatmentMatch && waitTimeMatch && priceMatch && ratingMatch
  })
}

export type ListingComparisonPageClientProps = {
  hero: {
    title: string
    subtitle: string
    features: string[]
    bulletStyle: 'circle' | 'check'
  }
  trust: {
    title: string
    subtitle: string
    stats: Array<{
      value: string
      label: string
      icon: 'users' | 'badgeCheck' | 'award' | 'shield'
    }>
    badges: string[]
  }
  results: ListingCardData[]
  filterOptions: {
    cities: string[]
    waitTimes: Array<{ label: string; minWeeks: number; maxWeeks?: number }>
    treatments: string[]
  }
}

const iconMap = {
  users: Users,
  badgeCheck: BadgeCheck,
  award: Award,
  shield: Shield,
} satisfies Record<ListingComparisonPageClientProps['trust']['stats'][number]['icon'], React.ComponentType>

export function ListingComparisonPageClient({ hero, trust, results, filterOptions }: ListingComparisonPageClientProps) {
  const [filters, setFilters] = React.useState<FilterState>({
    cities: [],
    waitTimes: [],
    treatments: [],
    priceRange: [1000, 20000],
    rating: null,
  })

  const filteredResults = React.useMemo(() => applyFilters(results, filters), [filters, results])

  return (
    <ListingComparison
      hero={hero}
      filters={
        <ListingComparisonFilters
          cityOptions={filterOptions.cities}
          waitTimeOptions={filterOptions.waitTimes}
          treatmentOptions={filterOptions.treatments}
          onChange={setFilters}
          debounceMs={100}
        />
      }
      results={filteredResults}
      emptyState={
        <div className="border-border bg-card text-muted-foreground rounded-2xl border p-6 text-sm">
          No clinics match these filters.
        </div>
      }
      trust={{
        ...trust,
        stats: trust.stats.map(({ icon, ...stat }) => ({
          ...stat,
          Icon: iconMap[icon],
        })),
      }}
    />
  )
}
