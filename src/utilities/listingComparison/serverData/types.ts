import type { ListingCardData } from '@/components/organisms/Listing'
import type { Clinic } from '@/payload-types'
import type { ListingComparisonQueryState } from '@/utilities/listingComparison/queryState'

export type FilterOption = {
  value: string
  label: string
}

export type SpecialtyContext = {
  selected: FilterOption[]
  breadcrumbs: Array<{ label: string; href: string }>
}

export type PaginationMeta = {
  page: number
  perPage: number
  totalPages: number
  totalResults: number
}

export type ListingComparisonServerData = {
  results: ListingCardData[]
  filterOptions: {
    cities: FilterOption[]
    treatments: FilterOption[]
    waitTimes: Array<{ label: string; minWeeks: number; maxWeeks?: number }>
  }
  priceBounds: {
    min: number
    max: number
  }
  queryState: ListingComparisonQueryState
  pagination: PaginationMeta
  specialtyContext: SpecialtyContext
}

export type CityMeta = {
  id: number
  name: string
  slug: string
}

export type TreatmentMeta = {
  id: number
  name: string
  slug: string
  medicalSpecialtyId: number | null
}

export type SpecialtyMeta = {
  id: number
  name: string
  slug: string
  parentId: number | null
}

export type ClinicRow = {
  clinic: Clinic
  cityId: number | null
  location: string
  locationHref?: string
  priceFrom: number | null
}

export type ClinicPresentationMeta = {
  cityId: number | null
  location: string
  locationHref?: string
}
