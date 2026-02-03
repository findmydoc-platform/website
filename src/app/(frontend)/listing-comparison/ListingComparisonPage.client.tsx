'use client'

import * as React from 'react'
import { Award, BadgeCheck, Shield, Users } from 'lucide-react'

import type { ListingCardData } from '@/components/organisms/Listing'
import { ListingComparison } from '@/components/templates/ListingComparison/Component'
import { applyListingComparisonFilters, type ListingComparisonFilterState } from '@/utilities/listingComparison/filters'
import { sortListingComparison, SORT_OPTIONS, type SortOption } from '@/utilities/listingComparison/sort'
import { SortControl } from '@/components/molecules/SortControl'
import { ListingComparisonFilters } from './ListingComparisonFilters.client'

type ListingComparisonTrustStatInput =
  | {
      label: string
      icon: 'users' | 'badgeCheck' | 'award' | 'shield'
      value: number
      prefix?: string
      suffix?: string
      decimals?: number
      locale?: string
    }
  | {
      label: string
      icon: 'users' | 'badgeCheck' | 'award' | 'shield'
      valueText: string
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
    stats: ListingComparisonTrustStatInput[]
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
} satisfies Record<ListingComparisonTrustStatInput['icon'], React.ComponentType>

export function ListingComparisonPageClient({ hero, trust, results, filterOptions }: ListingComparisonPageClientProps) {
  const [filters, setFilters] = React.useState<ListingComparisonFilterState>({
    cities: [],
    waitTimes: [],
    treatments: [],
    priceRange: [0, 20000],
    rating: null,
  })
  const [sortBy, setSortBy] = React.useState<SortOption>('rank')

  const filteredResults = React.useMemo(() => applyListingComparisonFilters(results, filters), [filters, results])
  const sortedResults = React.useMemo(() => sortListingComparison(filteredResults, sortBy), [filteredResults, sortBy])

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
      results={sortedResults}
      sortControl={<SortControl value={sortBy} onValueChange={setSortBy} options={SORT_OPTIONS} />}
      emptyState={
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No clinics match these filters.
        </div>
      }
      trust={{
        ...trust,
        stats: trust.stats.map((stat) => {
          const Icon = iconMap[stat.icon]

          if ('valueText' in stat) {
            return {
              label: stat.label,
              valueText: stat.valueText,
              Icon,
            }
          }

          return {
            label: stat.label,
            value: stat.value,
            prefix: stat.prefix,
            suffix: stat.suffix,
            decimals: stat.decimals,
            locale: stat.locale,
            Icon,
          }
        }),
      }}
    />
  )
}
