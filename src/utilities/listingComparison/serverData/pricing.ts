import { LISTING_COMPARISON_PRICE_MIN_DEFAULT } from '@/utilities/listingComparison/queryState'
import type { SortOption } from '@/utilities/listingComparison/sort'
import type { ClinicRow } from './types'

/**
 * Price-window and ordering helpers used by the listing-comparison server pipeline.
 * These functions intentionally operate on already-fetched in-memory row data.
 */
export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export function resolveScopedPriceFrom(
  minPriceByTreatmentId: Map<number, number> | undefined,
  treatmentScope: Set<number> | null,
): number | null {
  if (!minPriceByTreatmentId || minPriceByTreatmentId.size === 0) return null

  if (treatmentScope === null) {
    let minPrice = Number.POSITIVE_INFINITY
    minPriceByTreatmentId.forEach((price) => {
      if (price < minPrice) minPrice = price
    })
    return Number.isFinite(minPrice) ? minPrice : null
  }

  let minPrice = Number.POSITIVE_INFINITY
  treatmentScope.forEach((treatmentId) => {
    const price = minPriceByTreatmentId.get(treatmentId)
    if (typeof price === 'number' && Number.isFinite(price) && price < minPrice) {
      minPrice = price
    }
  })

  return Number.isFinite(minPrice) ? minPrice : null
}

export function applyPriceWindow(
  rows: ClinicRow[],
  priceMin: number,
  priceMax: number,
  defaultPriceMax: number,
): ClinicRow[] {
  const hasPriceWindowFilter = priceMin > LISTING_COMPARISON_PRICE_MIN_DEFAULT || priceMax < defaultPriceMax

  return rows.filter((row) => {
    if (row.priceFrom === null) {
      return !hasPriceWindowFilter
    }

    return row.priceFrom >= priceMin && row.priceFrom <= priceMax
  })
}

export function compareClinicRows(sortBy: SortOption, left: ClinicRow, right: ClinicRow): number {
  const leftPrice = left.priceFrom ?? Number.POSITIVE_INFINITY
  const rightPrice = right.priceFrom ?? Number.POSITIVE_INFINITY
  const leftRating = left.clinic.averageRating ?? 0
  const rightRating = right.clinic.averageRating ?? 0
  const leftName = left.clinic.name
  const rightName = right.clinic.name

  switch (sortBy) {
    case 'price-asc':
    case 'rank':
      if (leftPrice !== rightPrice) return leftPrice - rightPrice
      if (rightRating !== leftRating) return rightRating - leftRating
      return leftName.localeCompare(rightName)
    case 'price-desc':
      if (leftPrice !== rightPrice) return rightPrice - leftPrice
      if (rightRating !== leftRating) return rightRating - leftRating
      return leftName.localeCompare(rightName)
    case 'rating-desc':
      if (rightRating !== leftRating) return rightRating - leftRating
      if (leftPrice !== rightPrice) return leftPrice - rightPrice
      return leftName.localeCompare(rightName)
    case 'name-asc':
      return leftName.localeCompare(rightName)
    default:
      return leftName.localeCompare(rightName)
  }
}
