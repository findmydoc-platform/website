'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'

import {
  buildListingComparisonHref,
  buildListingComparisonSearchParams,
  type ListingComparisonQueryState,
} from '@/utilities/listingComparison/queryState'
import { clampPriceRange, type PriceBounds } from '@/utilities/listingComparison/priceRange'
import type { SortOption } from '@/utilities/listingComparison/sort'

const URL_UPDATE_DELAY_MS = 200

export type ListingComparisonFilterDraft = {
  cities: string[]
  specialty: string | null
  treatments: string[]
  priceRange: [number, number]
  rating: number | null
}

type UseListingComparisonUrlStateArgs = {
  queryState: ListingComparisonQueryState
  priceBounds: PriceBounds
}

type UseListingComparisonUrlStateResult = {
  sortSelection: SortOption
  setSortSelection: React.Dispatch<React.SetStateAction<SortOption>>
  filterDraft: ListingComparisonFilterDraft
  setFilterDraft: React.Dispatch<React.SetStateAction<ListingComparisonFilterDraft>>
  filterResetSignature: string
  buildPageHref: (targetPage: number) => string
  clearSpecialtySelection: () => void
}

function removeDuplicateSelections(values: string[]): string[] {
  const seenValues = new Set<string>()
  const deduplicatedValues: string[] = []

  values.forEach((value) => {
    if (seenValues.has(value)) return
    seenValues.add(value)
    deduplicatedValues.push(value)
  })

  return deduplicatedValues
}

function normalizeSingleSpecialtySelection(value: string | null): string | null {
  if (!value) return null
  return value.trim().length > 0 ? value : null
}

function hasSameValueSequence(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function isSameListingComparisonQueryState(
  left: ListingComparisonQueryState,
  right: ListingComparisonQueryState,
): boolean {
  return (
    left.page === right.page &&
    left.sort === right.sort &&
    left.ratingMin === right.ratingMin &&
    left.priceMin === right.priceMin &&
    left.priceMax === right.priceMax &&
    hasSameValueSequence(left.cities, right.cities) &&
    hasSameValueSequence(left.treatments, right.treatments) &&
    hasSameValueSequence(left.specialties, right.specialties)
  )
}

function buildQueryStateSignature(queryState: ListingComparisonQueryState): string {
  return [
    queryState.page,
    queryState.sort,
    queryState.ratingMin ?? 'none',
    queryState.priceMin,
    queryState.priceMax,
    queryState.cities.join(','),
    queryState.treatments.join(','),
    queryState.specialties.join(','),
  ].join('|')
}

function buildFilterResetSignature(queryState: ListingComparisonQueryState, priceBounds: PriceBounds): string {
  return [
    queryState.cities.join(','),
    queryState.specialties[0] ?? 'none',
    queryState.treatments.join(','),
    queryState.priceMin,
    queryState.priceMax,
    queryState.ratingMin ?? 'none',
    priceBounds.max,
  ].join('|')
}

export function useListingComparisonUrlState({
  queryState,
  priceBounds,
}: UseListingComparisonUrlStateArgs): UseListingComparisonUrlStateResult {
  const router = useRouter()
  const pathname = usePathname()

  const [sortSelection, setSortSelection] = React.useState<SortOption>(queryState.sort)
  const [filterDraft, setFilterDraft] = React.useState<ListingComparisonFilterDraft>({
    cities: queryState.cities,
    specialty: normalizeSingleSpecialtySelection(queryState.specialties[0] ?? null),
    treatments: queryState.treatments,
    priceRange: [queryState.priceMin, queryState.priceMax],
    rating: queryState.ratingMin,
  })

  const queryStateSignature = React.useMemo(() => buildQueryStateSignature(queryState), [queryState])
  const filterResetSignature = React.useMemo(
    () => buildFilterResetSignature(queryState, priceBounds),
    [priceBounds, queryState],
  )

  React.useEffect(() => {
    setSortSelection(queryState.sort)
    setFilterDraft({
      cities: queryState.cities,
      specialty: normalizeSingleSpecialtySelection(queryState.specialties[0] ?? null),
      treatments: queryState.treatments,
      priceRange: [queryState.priceMin, queryState.priceMax],
      rating: queryState.ratingMin,
    })
  }, [queryState, queryStateSignature])

  const navigateToQueryState = React.useCallback(
    (nextState: ListingComparisonQueryState, method: 'replace' | 'push' = 'replace') => {
      const params = buildListingComparisonSearchParams(nextState, {
        priceMax: priceBounds.max,
      })
      const query = params.toString()
      const href = query ? `${pathname}?${query}` : pathname

      if (method === 'push') {
        router.push(href, { scroll: false })
      } else {
        router.replace(href, { scroll: false })
      }
    },
    [pathname, priceBounds.max, router],
  )

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const clampedPriceRange = clampPriceRange(filterDraft.priceRange, priceBounds)
      const nextState: ListingComparisonQueryState = {
        ...queryState,
        page: 1,
        sort: sortSelection,
        cities: removeDuplicateSelections(filterDraft.cities),
        specialties: filterDraft.specialty ? [filterDraft.specialty] : [],
        treatments: removeDuplicateSelections(filterDraft.treatments),
        ratingMin: filterDraft.rating,
        priceMin: clampedPriceRange[0],
        priceMax: clampedPriceRange[1],
      }

      if (!isSameListingComparisonQueryState(nextState, queryState)) {
        navigateToQueryState(nextState, 'replace')
      }
    }, URL_UPDATE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [filterDraft, navigateToQueryState, priceBounds, queryState, sortSelection])

  const buildPageHref = React.useCallback(
    (targetPage: number) => {
      const nextState: ListingComparisonQueryState = { ...queryState, page: targetPage }
      return buildListingComparisonHref(nextState, {
        priceMax: priceBounds.max,
      })
    },
    [priceBounds.max, queryState],
  )

  const clearSpecialtySelection = React.useCallback(() => {
    const nextState: ListingComparisonQueryState = {
      ...queryState,
      page: 1,
      specialties: [],
      treatments: [],
    }
    navigateToQueryState(nextState, 'replace')
  }, [navigateToQueryState, queryState])

  return {
    sortSelection,
    setSortSelection,
    filterDraft,
    setFilterDraft,
    filterResetSignature,
    buildPageHref,
    clearSpecialtySelection,
  }
}
