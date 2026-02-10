'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Award, BadgeCheck, Shield, Users } from 'lucide-react'

import type { ListingCardData } from '@/components/organisms/Listing'
import { ListingComparison } from '@/components/templates/ListingComparison/Component'
import { SortControl } from '@/components/molecules/SortControl'
import { Pagination } from '@/components/molecules/Pagination'
import { Breadcrumb } from '@/components/molecules/Breadcrumb'
import {
  buildListingComparisonHref,
  LISTING_COMPARISON_PRICE_MIN_DEFAULT,
  buildListingComparisonSearchParams,
  type ListingComparisonQueryState,
} from '@/utilities/listingComparison/queryState'
import { SORT_OPTIONS, type SortOption } from '@/utilities/listingComparison/sort'
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

type ListingFilterOption = {
  value: string
  label: string
}

type ListingComparisonFilterState = {
  cities: string[]
  treatments: string[]
  priceRange: [number, number]
  rating: number | null
}

type ListingComparisonPagination = {
  page: number
  perPage: number
  totalPages: number
  totalResults: number
}

type ListingComparisonSpecialtyContext = {
  selected: ListingFilterOption[]
  breadcrumbs: Array<{ label: string; href: string }>
}

type ListingComparisonPriceBounds = {
  min: number
  max: number
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
  priceBounds: ListingComparisonPriceBounds
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

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  values.forEach((value) => {
    if (seen.has(value)) return
    seen.add(value)
    result.push(value)
  })

  return result
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function areQueryStatesEqual(left: ListingComparisonQueryState, right: ListingComparisonQueryState): boolean {
  return (
    left.page === right.page &&
    left.sort === right.sort &&
    left.ratingMin === right.ratingMin &&
    left.priceMin === right.priceMin &&
    left.priceMax === right.priceMax &&
    areStringArraysEqual(left.cities, right.cities) &&
    areStringArraysEqual(left.treatments, right.treatments) &&
    areStringArraysEqual(left.specialties, right.specialties)
  )
}

function normalizePriceBounds(priceBounds: ListingComparisonPriceBounds): ListingComparisonPriceBounds {
  const min =
    typeof priceBounds.min === 'number' && Number.isFinite(priceBounds.min)
      ? Math.max(priceBounds.min, LISTING_COMPARISON_PRICE_MIN_DEFAULT)
      : LISTING_COMPARISON_PRICE_MIN_DEFAULT
  const max =
    typeof priceBounds.max === 'number' && Number.isFinite(priceBounds.max) ? Math.max(priceBounds.max, min) : min

  return { min, max }
}

function normalizePriceRange(range: [number, number], priceBounds: ListingComparisonPriceBounds): [number, number] {
  const min = Number.isFinite(range[0]) ? range[0] : priceBounds.min
  const max = Number.isFinite(range[1]) ? range[1] : priceBounds.max
  const lower = Math.min(Math.max(min, priceBounds.min), priceBounds.max)
  const upper = Math.max(lower, Math.min(Math.max(max, lower), priceBounds.max))
  return [lower, upper]
}

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
  const router = useRouter()
  const pathname = usePathname()
  const normalizedPriceBounds = React.useMemo(() => normalizePriceBounds(priceBounds), [priceBounds])

  const [sortBy, setSortBy] = React.useState<SortOption>(queryState.sort)
  const [filters, setFilters] = React.useState<ListingComparisonFilterState>({
    cities: queryState.cities,
    treatments: queryState.treatments,
    priceRange: [queryState.priceMin, queryState.priceMax],
    rating: queryState.ratingMin,
  })

  const querySyncKey = React.useMemo(
    () =>
      [
        queryState.page,
        queryState.sort,
        queryState.ratingMin ?? 'none',
        queryState.priceMin,
        queryState.priceMax,
        queryState.cities.join(','),
        queryState.treatments.join(','),
        queryState.specialties.join(','),
      ].join('|'),
    [queryState],
  )

  React.useEffect(() => {
    setSortBy(queryState.sort)
    setFilters({
      cities: queryState.cities,
      treatments: queryState.treatments,
      priceRange: [queryState.priceMin, queryState.priceMax],
      rating: queryState.ratingMin,
    })
  }, [querySyncKey, queryState])

  const navigateWithState = React.useCallback(
    (nextState: ListingComparisonQueryState, method: 'replace' | 'push' = 'replace') => {
      const params = buildListingComparisonSearchParams(nextState, {
        priceMax: normalizedPriceBounds.max,
      })
      const query = params.toString()
      const href = query ? `${pathname}?${query}` : pathname

      if (method === 'push') {
        router.push(href, { scroll: false })
      } else {
        router.replace(href, { scroll: false })
      }
    },
    [normalizedPriceBounds.max, pathname, router],
  )

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalizedPriceRange = normalizePriceRange(filters.priceRange, normalizedPriceBounds)
      const nextState: ListingComparisonQueryState = {
        ...queryState,
        page: 1,
        sort: sortBy,
        cities: uniquePreserveOrder(filters.cities),
        treatments: uniquePreserveOrder(filters.treatments),
        ratingMin: filters.rating,
        priceMin: normalizedPriceRange[0],
        priceMax: normalizedPriceRange[1],
      }

      if (!areQueryStatesEqual(nextState, queryState)) {
        navigateWithState(nextState, 'replace')
      }
    }, 200)

    return () => window.clearTimeout(timer)
  }, [filters, navigateWithState, normalizedPriceBounds, queryState, sortBy])

  const specialtyChipLabel = React.useMemo(() => {
    if (specialtyContext.selected.length === 0) return null
    if (specialtyContext.selected.length === 1) return specialtyContext.selected[0]?.label ?? null

    const primary = specialtyContext.selected[0]?.label ?? 'Specialty'
    const remaining = specialtyContext.selected.length - 1
    return `${primary} +${remaining}`
  }, [specialtyContext.selected])

  const removeSpecialtyFilter = React.useCallback(() => {
    const nextState: ListingComparisonQueryState = {
      ...queryState,
      page: 1,
      specialties: [],
    }
    navigateWithState(nextState, 'replace')
  }, [navigateWithState, queryState])

  const filtersKey = React.useMemo(
    () =>
      [
        queryState.cities.join(','),
        queryState.treatments.join(','),
        queryState.priceMin,
        queryState.priceMax,
        queryState.ratingMin ?? 'none',
        normalizedPriceBounds.max,
      ].join('|'),
    [
      normalizedPriceBounds.max,
      queryState.cities,
      queryState.priceMax,
      queryState.priceMin,
      queryState.ratingMin,
      queryState.treatments,
    ],
  )

  const paginationPath = React.useCallback(
    (targetPage: number) => {
      const nextState: ListingComparisonQueryState = { ...queryState, page: targetPage }
      return buildListingComparisonHref(nextState, {
        priceMax: normalizedPriceBounds.max,
      })
    },
    [normalizedPriceBounds.max, queryState],
  )

  return (
    <ListingComparison
      hero={hero}
      filters={
        <ListingComparisonFilters
          key={filtersKey}
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
            setFilters({
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
              onClick={removeSpecialtyFilter}
              className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              title="Remove active specialty filter"
            >
              Specialty: {specialtyChipLabel} ×
            </button>
          ) : null}
          <SortControl value={sortBy} onValueChange={setSortBy} options={SORT_OPTIONS} />
        </div>
      }
      emptyState={
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No clinics match these filters.
        </div>
      }
      resultsFooter={
        pagination.totalPages > 1 ? (
          <Pagination page={pagination.page} totalPages={pagination.totalPages} getPathForPage={paginationPath} />
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
