'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import type { UiCopyLocale } from '@/i18n/requestLocale'

import { buildListingComparisonHref, type ListingComparisonQueryState } from '@/utilities/listingComparison/queryState'
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
  locale: UiCopyLocale
  queryState: ListingComparisonQueryState
  priceBounds: PriceBounds
}

type UseListingComparisonUrlStateResult = {
  sortSelection: SortOption
  setSortSelection: React.Dispatch<React.SetStateAction<SortOption>>
  setFilterDraft: React.Dispatch<React.SetStateAction<ListingComparisonFilterDraft>>
  filterResetSignature: string
  resultViewSignature: string
  buildPageHref: (targetPage: number) => string
  clearSpecialtySelection: () => void
  buildLanguageSwitchHref: (targetLocale: UiCopyLocale) => string
  cancelPendingFilterUpdate: () => void
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
  locale,
  queryState,
  priceBounds,
}: UseListingComparisonUrlStateArgs): UseListingComparisonUrlStateResult {
  const router = useRouter()
  const pendingFilterUpdate = React.useRef<number | null>(null)

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

  const draftQueryState = React.useMemo<ListingComparisonQueryState>(() => {
    const [priceMin, priceMax] = clampPriceRange(filterDraft.priceRange, priceBounds)
    return {
      page: queryState.page,
      sort: sortSelection,
      cities: removeDuplicateSelections(filterDraft.cities),
      specialties: filterDraft.specialty ? [filterDraft.specialty] : [],
      treatments: removeDuplicateSelections(filterDraft.treatments),
      ratingMin: filterDraft.rating,
      priceMin,
      priceMax,
    }
  }, [filterDraft, priceBounds, queryState.page, sortSelection])
  const hasFilterChanges = !isSameListingComparisonQueryState(draftQueryState, queryState)
  const buildLanguageSwitchHref = (targetLocale: UiCopyLocale) =>
    buildListingComparisonHref(hasFilterChanges ? { ...draftQueryState, page: 1 } : queryState, {
      locale: targetLocale,
      priceMax: priceBounds.max,
    })

  const cancelPendingFilterUpdate = React.useCallback(() => {
    if (pendingFilterUpdate.current === null) return
    window.clearTimeout(pendingFilterUpdate.current)
    pendingFilterUpdate.current = null
  }, [])

  const navigateToQueryState = React.useCallback(
    (nextState: ListingComparisonQueryState) => {
      const href = buildListingComparisonHref(nextState, { locale, priceMax: priceBounds.max })
      router.replace(href, { scroll: false })
    },
    [locale, priceBounds.max, router],
  )

  React.useEffect(() => {
    if (!hasFilterChanges) return

    pendingFilterUpdate.current = window.setTimeout(() => {
      pendingFilterUpdate.current = null
      navigateToQueryState({ ...draftQueryState, page: 1 })
    }, URL_UPDATE_DELAY_MS)

    return cancelPendingFilterUpdate
  }, [cancelPendingFilterUpdate, draftQueryState, hasFilterChanges, navigateToQueryState])

  const buildPageHref = (targetPage: number) =>
    buildListingComparisonHref({ ...queryState, page: targetPage }, { locale, priceMax: priceBounds.max })

  const clearSpecialtySelection = React.useCallback(() => {
    const nextState: ListingComparisonQueryState = {
      ...queryState,
      page: 1,
      specialties: [],
      treatments: [],
    }
    cancelPendingFilterUpdate()
    navigateToQueryState(nextState)
  }, [cancelPendingFilterUpdate, navigateToQueryState, queryState])

  return {
    sortSelection,
    setSortSelection,
    setFilterDraft,
    filterResetSignature,
    resultViewSignature: queryStateSignature,
    buildPageHref,
    clearSpecialtySelection,
    buildLanguageSwitchHref,
    cancelPendingFilterUpdate,
  }
}
