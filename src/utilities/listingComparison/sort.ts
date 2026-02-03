import type { ListingCardData } from '@/components/organisms/Listing'

export type SortOption = 'rank' | 'price-asc' | 'price-desc' | 'rating-desc' | 'name-asc'

/**
 * Sort listing comparison results based on the selected option.
 *
 * This function is intentionally UI-agnostic and handles sorting logic
 * for listing cards based on various criteria.
 */
export function sortListingComparison(list: ListingCardData[], sortBy: SortOption): ListingCardData[] {
  // Create a shallow copy to avoid mutating the original array
  const sorted = [...list]

  switch (sortBy) {
    // 'rank' (best match) is handled via the default branch below. The
    // upstream data source provides the preferred ordering, so we preserve
    // the original array when the consumer selects the "best match" option.
    case 'price-asc':
      // Sort by price ascending (lower prices first)
      // Clinics without price go to the end
      return sorted.sort((a, b) => {
        const priceA = a.priceFrom?.value ?? Infinity
        const priceB = b.priceFrom?.value ?? Infinity
        return priceA - priceB
      })

    case 'price-desc':
      // Sort by price descending (higher prices first)
      // Clinics without price go to the end
      return sorted.sort((a, b) => {
        const priceA = a.priceFrom?.value ?? -Infinity
        const priceB = b.priceFrom?.value ?? -Infinity
        return priceB - priceA
      })

    case 'rating-desc':
      // Sort by rating descending (highest rating first)
      return sorted.sort((a, b) => {
        const ratingA = a.rating?.value ?? 0
        const ratingB = b.rating?.value ?? 0
        return ratingB - ratingA
      })

    case 'name-asc':
      // Sort by name alphabetically (A-Z)
      return sorted.sort((a, b) => a.name.localeCompare(b.name))

    default:
      return sorted
  }
}

/**
 * Get human-readable label for sort option
 */
export function getSortLabel(sortOption: SortOption): string {
  switch (sortOption) {
    case 'rank':
      return 'Best match'
    case 'price-asc':
      return 'Price: Low to High'
    case 'price-desc':
      return 'Price: High to Low'
    case 'rating-desc':
      return 'Highest rated'
    case 'name-asc':
      return 'Name: A-Z'
    default:
      return 'Best match'
  }
}

/**
 * Get all available sort options with labels
 */
export const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'rank', label: 'Best match' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating-desc', label: 'Highest rated' },
  { value: 'name-asc', label: 'Name: A-Z' },
]
