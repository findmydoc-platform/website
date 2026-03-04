import type { ListingCardData, ListingWaitTime } from '@/components/organisms/Listing'

export type ListingComparisonFilterState = {
  cities: string[]
  specialty: string | null
  waitTimes: Array<{ minWeeks: number; maxWeeks?: number }>
  treatments: string[]
  priceRange: [number, number]
  rating: number | null
}

function matchesWaitTime(waitTime: ListingWaitTime, filters: ListingComparisonFilterState['waitTimes']): boolean {
  if (filters.length === 0) return true

  const clinicMin = waitTime.minWeeks
  const clinicMax = waitTime.maxWeeks ?? waitTime.minWeeks

  return filters.some((range) => {
    const rangeMin = range.minWeeks
    const rangeMax = range.maxWeeks

    const minOk = clinicMin >= rangeMin
    const maxOk = rangeMax === undefined ? clinicMin >= rangeMin : clinicMax <= rangeMax

    return minOk && maxOk
  })
}

/**
 * Story/Test helper: apply local filtering to listing cards.
 * Production listing pages rely on server-side filtering and do not use this helper.
 */
export function applyListingComparisonLocalFilters(
  list: ListingCardData[],
  filters: ListingComparisonFilterState,
): ListingCardData[] {
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
      if (filters.waitTimes.length === 0) return true
      if (!clinic.waitTime) return false
      return matchesWaitTime(clinic.waitTime, filters.waitTimes)
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
