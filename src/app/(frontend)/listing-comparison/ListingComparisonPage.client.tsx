'use client'

import * as React from 'react'
import { Award, BadgeCheck, Shield, Users } from 'lucide-react'

import type { ListingCardData } from '@/components/organisms/Listing'
import { ListingComparison } from '@/components/templates/ListingComparison/Component'
import { SortControl } from '@/components/molecules/SortControl'
import { Pagination } from '@/components/molecules/Pagination'
import { Breadcrumb } from '@/components/molecules/Breadcrumb'
import {
  LISTING_COMPARISON_PRICE_MIN_DEFAULT,
  type ListingComparisonQueryState,
} from '@/utilities/listingComparison/queryState'
import { SORT_OPTIONS } from '@/utilities/listingComparison/sort'
import { normalizePriceBounds, type PriceBounds } from '@/utilities/listingComparison/priceRange'
import { ListingComparisonFilters } from './ListingComparisonFilters.client'
import { useListingComparisonUrlState } from './useListingComparisonUrlState'

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

type ListingFilterOption = {
  value: string
  label: string
  disabled?: boolean
}

type ListingComparisonPagination = {
  page: number
  perPage: number
  totalPages: number
  totalResults: number
  totalAvailableResults: number
}

type ListingComparisonSpecialtyContext = {
  selected: ListingFilterOption[]
  breadcrumbs: Array<{ label: string; href: string }>
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
    cities: ListingFilterOption[]
    waitTimes: Array<{ label: string; minWeeks: number; maxWeeks?: number }>
    treatments: ListingFilterOption[]
  }
  priceBounds: PriceBounds
  queryState: ListingComparisonQueryState
  pagination: ListingComparisonPagination
  specialtyContext: ListingComparisonSpecialtyContext
}

const iconMap = {
  users: Users,
  badgeCheck: BadgeCheck,
  award: Award,
  shield: Shield,
} satisfies Record<ListingComparisonTrustStatInput['icon'], React.ComponentType>

export function ListingComparisonPageClient({
  hero,
  trust,
  results,
  filterOptions,
  priceBounds,
  queryState,
  pagination,
  specialtyContext,
}: ListingComparisonPageClientProps) {
  const normalizedPriceBounds = React.useMemo(
    () =>
      normalizePriceBounds(priceBounds, {
        min: LISTING_COMPARISON_PRICE_MIN_DEFAULT,
        max: LISTING_COMPARISON_PRICE_MIN_DEFAULT,
      }),
    [priceBounds],
  )
  const {
    sortSelection,
    setSortSelection,
    setFilterDraft,
    filterResetSignature,
    buildPageHref,
    clearSpecialtySelection,
  } = useListingComparisonUrlState({
    queryState,
    priceBounds: normalizedPriceBounds,
  })

  const specialtyChipLabel = React.useMemo(() => {
    if (specialtyContext.selected.length === 0) return null
    if (specialtyContext.selected.length === 1) return specialtyContext.selected[0]?.label ?? null

    const primary = specialtyContext.selected[0]?.label ?? 'Specialty'
    const remaining = specialtyContext.selected.length - 1
    return `${primary} +${remaining}`
  }, [specialtyContext.selected])

  return (
    <ListingComparison
      hero={hero}
      filters={
        <ListingComparisonFilters
          key={filterResetSignature}
          cityOptions={filterOptions.cities}
          waitTimeOptions={filterOptions.waitTimes}
          treatmentOptions={filterOptions.treatments}
          priceBounds={normalizedPriceBounds}
          initialValues={{
            cities: queryState.cities,
            treatments: queryState.treatments,
            waitTimes: [],
            priceRange: [queryState.priceMin, queryState.priceMax],
            rating: queryState.ratingMin,
          }}
          onChange={(nextFilters) => {
            setFilterDraft({
              cities: nextFilters.cities,
              treatments: nextFilters.treatments,
              priceRange: nextFilters.priceRange,
              rating: nextFilters.rating,
            })
          }}
        />
      }
      totalResultsCount={pagination.totalResults}
      results={results}
      resultsContext={
        specialtyContext.breadcrumbs.length > 0 ? <Breadcrumb items={specialtyContext.breadcrumbs} /> : null
      }
      sortControl={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {specialtyChipLabel ? (
            <button
              type="button"
              onClick={clearSpecialtySelection}
              className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              title="Remove active specialty filter"
            >
              Specialty: {specialtyChipLabel} ×
            </button>
          ) : null}
          <SortControl value={sortSelection} onValueChange={setSortSelection} options={SORT_OPTIONS} />
        </div>
      }
      emptyState={
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No clinics match these filters.
        </div>
      }
      resultsFooter={
        pagination.totalPages > 1 ? (
          <Pagination page={pagination.page} totalPages={pagination.totalPages} getPathForPage={buildPageHref} />
        ) : null
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
