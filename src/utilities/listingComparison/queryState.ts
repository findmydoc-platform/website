import type { SortOption } from '@/utilities/listingComparison/sort'

export const LISTING_COMPARISON_PER_PAGE = 24
export const LISTING_COMPARISON_PRICE_MIN_DEFAULT = 0
export const LISTING_COMPARISON_PRICE_MAX_DEFAULT = 20000
export const LISTING_COMPARISON_RATING_MIN_DEFAULT = 0

export type ListingComparisonQueryState = {
  page: number
  sort: SortOption
  cities: string[]
  treatments: string[]
  specialties: string[]
  ratingMin: number | null
  priceMin: number
  priceMax: number
}

export type ListingComparisonLegacyQuery = {
  service: string | null
  location: string | null
  budget: number | null
}

export type ListingComparisonRawSearchParams = Record<string, string | string[] | undefined>

export type ParsedListingComparisonQuery = {
  state: ListingComparisonQueryState
  legacy: ListingComparisonLegacyQuery
}

export type ListingComparisonSearchParamDefaults = {
  priceMin?: number
  priceMax?: number
}

const SORT_OPTIONS: SortOption[] = ['rank', 'price-asc', 'price-desc', 'rating-desc', 'name-asc']

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const parseArrayParam = (params: ListingComparisonRawSearchParams, key: string): string[] => {
  const raw = params[key]
  if (!raw) return []
  const rawEntries = Array.isArray(raw) ? raw : [raw]
  const values = rawEntries.flatMap((entry) => entry.split(','))

  const deduped = new Set<string>()
  values
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => deduped.add(entry))

  return Array.from(deduped)
}

const parseSingleParam = (params: ListingComparisonRawSearchParams, key: string): string | null => {
  const raw = params[key]
  if (!raw) return null
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const parseFiniteNumber = (value: string | null): number | null => {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const parseSort = (value: string | null): SortOption => {
  if (!value) return 'rank'
  return SORT_OPTIONS.includes(value as SortOption) ? (value as SortOption) : 'rank'
}

function normalizeSearchParamDefaults(
  defaults: ListingComparisonSearchParamDefaults = {},
): Required<ListingComparisonSearchParamDefaults> {
  const minCandidate = defaults.priceMin
  const normalizedMin =
    typeof minCandidate === 'number' && Number.isFinite(minCandidate)
      ? Math.max(minCandidate, LISTING_COMPARISON_PRICE_MIN_DEFAULT)
      : LISTING_COMPARISON_PRICE_MIN_DEFAULT

  const maxCandidate = defaults.priceMax
  const normalizedMax =
    typeof maxCandidate === 'number' && Number.isFinite(maxCandidate)
      ? Math.max(maxCandidate, normalizedMin)
      : LISTING_COMPARISON_PRICE_MAX_DEFAULT

  return {
    priceMin: normalizedMin,
    priceMax: normalizedMax,
  }
}

export function parseListingComparisonQueryState(
  params: ListingComparisonRawSearchParams = {},
): ParsedListingComparisonQuery {
  const pageInput = parseFiniteNumber(parseSingleParam(params, 'page'))
  const sortInput = parseSort(parseSingleParam(params, 'sort'))
  const ratingInput = parseFiniteNumber(parseSingleParam(params, 'ratingMin'))
  const priceMinInput = parseFiniteNumber(parseSingleParam(params, 'priceMin'))
  const priceMaxInput = parseFiniteNumber(parseSingleParam(params, 'priceMax'))
  const budgetInput = parseFiniteNumber(parseSingleParam(params, 'budget'))

  const page = pageInput && pageInput > 0 ? Math.floor(pageInput) : 1
  const ratingMin =
    ratingInput === null ? null : clamp(Math.round(ratingInput * 10) / 10, LISTING_COMPARISON_RATING_MIN_DEFAULT, 5)
  const priceMin =
    priceMinInput === null
      ? LISTING_COMPARISON_PRICE_MIN_DEFAULT
      : Math.max(priceMinInput, LISTING_COMPARISON_PRICE_MIN_DEFAULT)

  const fallbackPriceMax =
    budgetInput !== null && budgetInput >= LISTING_COMPARISON_PRICE_MIN_DEFAULT
      ? budgetInput
      : LISTING_COMPARISON_PRICE_MAX_DEFAULT
  const rawPriceMax = priceMaxInput === null ? fallbackPriceMax : priceMaxInput
  const priceMax = Math.max(rawPriceMax, priceMin)

  const legacy: ListingComparisonLegacyQuery = {
    service: parseSingleParam(params, 'service'),
    location: parseSingleParam(params, 'location'),
    budget: budgetInput,
  }

  return {
    state: {
      page,
      sort: sortInput,
      cities: parseArrayParam(params, 'city'),
      treatments: parseArrayParam(params, 'treatment'),
      specialties: parseArrayParam(params, 'specialty'),
      ratingMin,
      priceMin,
      priceMax,
    },
    legacy,
  }
}

export function buildListingComparisonSearchParams(
  state: ListingComparisonQueryState,
  defaults: ListingComparisonSearchParamDefaults = {},
): URLSearchParams {
  const normalizedDefaults = normalizeSearchParamDefaults(defaults)
  const params = new URLSearchParams()

  if (state.page > 1) {
    params.set('page', String(state.page))
  }

  if (state.sort !== 'rank') {
    params.set('sort', state.sort)
  }

  if (state.cities.length > 0) {
    params.set('city', state.cities.join(','))
  }
  if (state.treatments.length > 0) {
    params.set('treatment', state.treatments.join(','))
  }
  if (state.specialties.length > 0) {
    params.set('specialty', state.specialties.join(','))
  }

  if (state.ratingMin !== null) {
    params.set('ratingMin', String(state.ratingMin))
  }

  if (state.priceMin > normalizedDefaults.priceMin) {
    params.set('priceMin', String(state.priceMin))
  }

  if (state.priceMax < normalizedDefaults.priceMax) {
    params.set('priceMax', String(state.priceMax))
  }

  return params
}

export function buildListingComparisonHref(
  state: ListingComparisonQueryState,
  defaults: ListingComparisonSearchParamDefaults = {},
): string {
  const params = buildListingComparisonSearchParams(state, defaults)
  const query = params.toString()
  return query ? `/listing-comparison?${query}` : '/listing-comparison'
}
