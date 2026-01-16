'use client'

import * as React from 'react'
import { Award, BadgeCheck, Shield, Users } from 'lucide-react'

import type { ListingCardData } from '@/components/organisms/Listing'
import { ListingComparison } from '@/components/templates/ListingComparison/Component'
import { applyListingComparisonFilters, type ListingComparisonFilterState } from '@/utilities/listingComparison/filters'
import { ListingComparisonFilters } from './ListingComparisonFilters.client'

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
  const [filters, setFilters] = React.useState<ListingComparisonFilterState>({
    cities: [],
    waitTimes: [],
    treatments: [],
    priceRange: [0, 20000],
    rating: null,
  })

  const filteredResults = React.useMemo(() => applyListingComparisonFilters(results, filters), [filters, results])

  return (
    <ListingComparison
      hero={hero}
      filters={
        <ListingComparisonFilters
          cityOptions={filterOptions.cities}
          waitTimeOptions={filterOptions.waitTimes}
          treatmentOptions={filterOptions.treatments}
          onChange={setFilters}
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
