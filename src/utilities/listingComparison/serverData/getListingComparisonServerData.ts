import type { Payload } from 'payload'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'
import type { City, Clinic, MedicalSpecialty, Treatment } from '@/payload-types'
import { CLINICS_BREADCRUMB, HOME_BREADCRUMB } from '@/utilities/breadcrumbs'
import { buildCollectionTag, buildSitemapTag, buildSurfaceTag } from '@/utilities/cachePolicy'
import { buildFreshnessSignals } from '@/utilities/freshness'
import { findLatestIsoTimestampString } from '@/utilities/timestamps'
import { slugify } from '@/utilities/slugify'
import {
  buildListingComparisonHref,
  LISTING_COMPARISON_PER_PAGE,
  LISTING_COMPARISON_PRICE_MIN_DEFAULT,
  parseListingComparisonQueryState,
  type ListingComparisonRawSearchParams,
  type ListingComparisonQueryState,
} from '@/utilities/listingComparison/queryState'
import {
  buildCityFacetOptions,
  buildTreatmentFacetOptions,
  canonicalizeFilterValues,
  toBaseFilterOptions,
  toCityMetaFromDocs,
} from './facets'
import { applyPriceWindow, clamp, compareClinicRows } from './pricing'
import { buildClinicPresentationMeta, buildScopedClinicRows, mapListingCardResults } from './presentation'
import { extractRelationId } from './relations'
import {
  countApprovedReviewsByClinic,
  findAllCities,
  findAllSpecialties,
  findAllTreatments,
  findClinicTreatmentsForClinics,
  findLatestApprovedReviewDateForClinics,
  findListingComparisonCatalog,
} from './repositories'
import { buildClinicThumbnailDescriptorsByClinicId } from '@/utilities/media/clinicThumbnail'
import {
  buildSpecialtyFilterOptions,
  buildSpecialtyPath,
  buildSpecialtyTree,
  collectDescendantSpecialties,
} from './specialtyScope'
import type { ListingComparisonServerData, SpecialtyMeta, TreatmentMeta } from './types'

const LISTING_COMPARISON_CACHE_KEY_VERSION = '2026-07-08'

type ListingComparisonCacheFacets = {
  readonly cityDocs: readonly City[]
  readonly treatmentDocs: readonly Treatment[]
  readonly specialtyDocs: readonly MedicalSpecialty[]
}

const getCachedListingComparisonCacheFacets = () =>
  unstable_cache(
    async (): Promise<ListingComparisonCacheFacets> => {
      const payload = await getPayload({ config: configPromise })
      const [cityDocs, treatmentDocs, specialtyDocs] = await Promise.all([
        findAllCities(payload),
        findAllTreatments(payload),
        findAllSpecialties(payload),
      ])

      return {
        cityDocs,
        treatmentDocs,
        specialtyDocs,
      }
    },
    ['listing-comparison-cache-facets'],
    {
      tags: [buildCollectionTag('cities'), buildCollectionTag('treatments'), buildCollectionTag('medical-specialties')],
    },
  )

export const buildListingComparisonDataCacheTags = (): string[] => [
  buildSurfaceTag('listing-comparison'),
  buildCollectionTag('clinics'),
  buildCollectionTag('clinictreatments'),
  buildCollectionTag('reviews'),
  buildCollectionTag('treatments'),
  buildCollectionTag('medical-specialties'),
  buildCollectionTag('cities'),
  buildSitemapTag('pages'),
]

export function buildListingComparisonDataCacheKey(state: ListingComparisonQueryState): string {
  return JSON.stringify({
    version: LISTING_COMPARISON_CACHE_KEY_VERSION,
    page: state.page,
    sort: state.sort,
    cities: [...state.cities].sort(),
    treatments: [...state.treatments].sort(),
    specialties: [...state.specialties].sort(),
    ratingMin: state.ratingMin,
    priceMin: state.priceMin,
    priceMax: state.priceMax,
  })
}

export function buildListingComparisonResolvedDataCacheKey(
  searchParams: ListingComparisonRawSearchParams = {},
  { cityDocs, specialtyDocs, treatmentDocs }: ListingComparisonCacheFacets,
): string {
  const parsed = parseListingComparisonQueryState(searchParams)
  const cityMeta = toCityMetaFromDocs([...cityDocs])
  const cityOptions = toBaseFilterOptions(cityMeta)

  const specialtiesMeta: SpecialtyMeta[] = specialtyDocs.map((specialty) => ({
    id: specialty.id,
    name: specialty.name,
    slug: slugify(specialty.name),
    parentId: extractRelationId(specialty.parentSpecialty),
  }))
  const specialtyOptions = buildSpecialtyFilterOptions(specialtiesMeta)

  const treatmentsMeta: TreatmentMeta[] = treatmentDocs.map((treatment) => ({
    id: treatment.id,
    name: treatment.name,
    slug: slugify(treatment.name),
    medicalSpecialtyId: extractRelationId(treatment.medicalSpecialty),
  }))
  const treatmentOptions = toBaseFilterOptions(treatmentsMeta)

  const serviceFilters = resolveServiceFilterValues({
    requestedSpecialtyValues: parsed.state.specialties,
    requestedTreatmentValues: parsed.state.treatments,
    legacyServiceValue: parsed.legacy.service ?? undefined,
    specialtyOptions,
    treatmentOptions,
  })

  return buildListingComparisonDataCacheKey({
    ...parsed.state,
    cities: resolveSelectedOptionValues({
      requestedValues: parsed.state.cities,
      legacyFallbackValue: parsed.legacy.location ?? undefined,
      options: cityOptions,
    }),
    treatments: serviceFilters.treatments,
    specialties: serviceFilters.specialties,
  })
}

const resolveListingComparisonDataCacheKey = async (
  searchParams: ListingComparisonRawSearchParams = {},
): Promise<string> => {
  const facets = await getCachedListingComparisonCacheFacets()()

  return buildListingComparisonResolvedDataCacheKey(searchParams, facets)
}

export const getCachedListingComparisonServerData = async (
  searchParams: ListingComparisonRawSearchParams = {},
): Promise<ListingComparisonServerData> => {
  const cacheKey = await resolveListingComparisonDataCacheKey(searchParams)

  return unstable_cache(
    async () => {
      const payload = await getPayload({ config: configPromise })

      return getListingComparisonServerData(payload, searchParams)
    },
    ['listing-comparison-server-data', cacheKey],
    {
      tags: buildListingComparisonDataCacheTags(),
    },
  )()
}

type FilterOptionValue = {
  value: string
  label: string
}

function resolveServiceFilterValues({
  requestedSpecialtyValues,
  requestedTreatmentValues,
  legacyServiceValue,
  specialtyOptions,
  treatmentOptions,
}: {
  requestedSpecialtyValues: string[]
  requestedTreatmentValues: string[]
  legacyServiceValue?: string
  specialtyOptions: FilterOptionValue[]
  treatmentOptions: FilterOptionValue[]
}): { specialties: string[]; treatments: string[] } {
  const requestedSpecialties = canonicalizeFilterValues(requestedSpecialtyValues, specialtyOptions)
  const requestedSpecialty = resolveSingleSelectedOptionValue(requestedSpecialties)
  const requestedTreatments = canonicalizeFilterValues(requestedTreatmentValues, treatmentOptions)

  if (requestedSpecialty || requestedTreatments.length > 0 || !legacyServiceValue) {
    return {
      specialties: requestedSpecialty ? [requestedSpecialty] : [],
      treatments: requestedTreatments,
    }
  }

  const legacySpecialties = canonicalizeFilterValues([legacyServiceValue], specialtyOptions)
  const legacySpecialty = resolveSingleSelectedOptionValue(legacySpecialties)

  if (legacySpecialty) {
    return {
      specialties: [legacySpecialty],
      treatments: [],
    }
  }

  return {
    specialties: [],
    treatments: canonicalizeFilterValues([legacyServiceValue], treatmentOptions),
  }
}

function resolveSelectedOptionValues({
  requestedValues,
  legacyFallbackValue,
  options,
}: {
  requestedValues: string[]
  legacyFallbackValue?: string
  options: FilterOptionValue[]
}): string[] {
  const selectedValues = canonicalizeFilterValues(requestedValues, options)
  if (selectedValues.length > 0 || !legacyFallbackValue) {
    return selectedValues
  }

  return canonicalizeFilterValues([legacyFallbackValue], options)
}

function resolveSelectedIdsFromOptions(selectedValues: string[], idByValue: Map<string, number>): number[] {
  return selectedValues.map((value) => idByValue.get(value)).filter((id): id is number => typeof id === 'number')
}

function resolveSingleSelectedOptionValue(selectedValues: string[]): string | null {
  const first = selectedValues[0]
  return typeof first === 'string' && first.length > 0 ? first : null
}

function filterClinicsByMinimumRating(clinics: Clinic[], ratingMin: number | null) {
  if (ratingMin === null) return clinics

  return clinics.filter((clinic) => {
    const rating = clinic.averageRating ?? 0
    return rating >= ratingMin
  })
}

function isVerifiedClinic(clinic: Clinic): boolean {
  return clinic.verification === 'bronze' || clinic.verification === 'silver' || clinic.verification === 'gold'
}

function countApprovedClinicCities(clinics: Clinic[]): number {
  const cityIds = new Set<number>()

  clinics.forEach((clinic) => {
    const cityId = extractRelationId(clinic.address?.city)
    if (cityId) cityIds.add(cityId)
  })

  return cityIds.size
}

function countPriceEntries(clinicTreatments: Awaited<ReturnType<typeof findClinicTreatmentsForClinics>>): number {
  const pricedClinicTreatments = new Set<string>()

  clinicTreatments.forEach((entry) => {
    const clinicId = extractRelationId(entry.clinic)
    const treatmentId = extractRelationId(entry.treatment)
    const price = entry.price

    if (!clinicId || !treatmentId || typeof price !== 'number' || !Number.isFinite(price)) return

    pricedClinicTreatments.add(`${clinicId}:${treatmentId}`)
  })

  return pricedClinicTreatments.size
}

/**
 * Orchestrates server-side listing comparison data assembly.
 * This keeps all business rules in one place while delegating pure helpers and repository calls to sub-modules.
 */
export async function getListingComparisonServerData(
  payload: Payload,
  searchParams: ListingComparisonRawSearchParams = {},
): Promise<ListingComparisonServerData> {
  const parsed = parseListingComparisonQueryState(searchParams)
  const initialQueryState = parsed.state

  const { cityDocs, treatmentDocs, specialtyDocs, approvedClinics, availableClinicMediaFiles } =
    await findListingComparisonCatalog(payload)
  const totalAvailableResults = approvedClinics.length
  const verifiedClinics = approvedClinics.filter((clinic) => isVerifiedClinic(clinic)).length
  const treatmentTypes = treatmentDocs.length
  const cities = countApprovedClinicCities(approvedClinics)
  const approvedClinicIds = approvedClinics.map((clinic) => clinic.id)
  const [catalogClinicTreatments, latestApprovedReviewAt] = await Promise.all([
    findClinicTreatmentsForClinics(payload, approvedClinicIds),
    findLatestApprovedReviewDateForClinics(payload, approvedClinicIds),
  ])
  const priceEntries = countPriceEntries(catalogClinicTreatments)
  const freshness = buildFreshnessSignals({
    updatedAt: findLatestIsoTimestampString([
      ...approvedClinics.map((clinic) => clinic.updatedAt),
      ...catalogClinicTreatments.map((entry) => entry.updatedAt),
      ...cityDocs.map((city) => city.updatedAt),
      ...treatmentDocs.map((treatment) => treatment.updatedAt),
      ...specialtyDocs.map((specialty) => specialty.updatedAt),
    ]),
    latestPatientReviewAt: latestApprovedReviewAt,
    sourceCollections: ['clinics', 'clinictreatments', 'reviews', 'cities', 'treatments', 'medical-specialties'],
  })

  const cityMeta = toCityMetaFromDocs(cityDocs)
  const cityOptions = toBaseFilterOptions(cityMeta)

  const selectedCityValues = resolveSelectedOptionValues({
    requestedValues: initialQueryState.cities,
    legacyFallbackValue: parsed.legacy.location ?? undefined,
    options: cityOptions,
  })

  const cityIdByValue = new Map(cityMeta.map((city) => [String(city.id), city.id]))
  const cityMetaById = new Map(cityMeta.map((city) => [city.id, city]))
  const selectedCityIds = new Set(resolveSelectedIdsFromOptions(selectedCityValues, cityIdByValue))

  const specialtiesMeta: SpecialtyMeta[] = specialtyDocs.map((specialty) => ({
    id: specialty.id,
    name: specialty.name,
    slug: slugify(specialty.name),
    parentId: extractRelationId(specialty.parentSpecialty),
  }))
  const specialtyOptions = buildSpecialtyFilterOptions(specialtiesMeta)

  const specialtyById = new Map(specialtiesMeta.map((specialty) => [specialty.id, specialty]))
  const specialtyIdByValue = new Map(specialtiesMeta.map((specialty) => [String(specialty.id), specialty.id]))
  const specialtyOptionByValue = new Map(specialtyOptions.map((specialty) => [specialty.value, specialty]))
  const specialtyTree = buildSpecialtyTree(specialtiesMeta)

  const treatmentsMeta: TreatmentMeta[] = treatmentDocs.map((treatment) => ({
    id: treatment.id,
    name: treatment.name,
    slug: slugify(treatment.name),
    medicalSpecialtyId: extractRelationId(treatment.medicalSpecialty),
  }))
  const allTreatmentOptions = toBaseFilterOptions(treatmentsMeta)

  const serviceFilters = resolveServiceFilterValues({
    requestedSpecialtyValues: initialQueryState.specialties,
    requestedTreatmentValues: initialQueryState.treatments,
    legacyServiceValue: parsed.legacy.service ?? undefined,
    specialtyOptions,
    treatmentOptions: allTreatmentOptions,
  })
  const selectedSpecialtyValues = serviceFilters.specialties
  const selectedTreatmentValues = serviceFilters.treatments
  const selectedSpecialtyIds = resolveSelectedIdsFromOptions(selectedSpecialtyValues, specialtyIdByValue)
  const specialtyScope = collectDescendantSpecialties(selectedSpecialtyIds, specialtyTree)

  const treatmentIdByValue = new Map(treatmentsMeta.map((treatment) => [String(treatment.id), treatment.id]))
  const selectedTreatmentIds = resolveSelectedIdsFromOptions(selectedTreatmentValues, treatmentIdByValue)

  const specialtyTreatmentIds = new Set<number>()
  if (specialtyScope.size > 0) {
    treatmentsMeta.forEach((treatment) => {
      if (treatment.medicalSpecialtyId && specialtyScope.has(treatment.medicalSpecialtyId)) {
        specialtyTreatmentIds.add(treatment.id)
      }
    })
  }

  const ratingFilteredClinics = filterClinicsByMinimumRating(approvedClinics, initialQueryState.ratingMin)

  const ratingFilteredClinicIds = new Set(ratingFilteredClinics.map((clinic) => clinic.id))
  const clinicTreatments = catalogClinicTreatments.filter((entry) => {
    const clinicId = extractRelationId(entry.clinic)
    return typeof clinicId === 'number' && ratingFilteredClinicIds.has(clinicId)
  })

  const minPriceByTreatmentByClinicId = new Map<number, Map<number, number>>()

  clinicTreatments.forEach((entry) => {
    const clinicId = extractRelationId(entry.clinic)
    const treatmentId = extractRelationId(entry.treatment)
    const price = entry.price
    if (!clinicId || !treatmentId || typeof price !== 'number' || !Number.isFinite(price)) return

    const priceByTreatment = minPriceByTreatmentByClinicId.get(clinicId) ?? new Map<number, number>()
    const existingPrice = priceByTreatment.get(treatmentId)
    priceByTreatment.set(treatmentId, typeof existingPrice === 'number' ? Math.min(existingPrice, price) : price)
    minPriceByTreatmentByClinicId.set(clinicId, priceByTreatment)
  })

  const presentationByClinicId = new Map(
    ratingFilteredClinics.map((clinic) => [clinic.id, buildClinicPresentationMeta(clinic, cityMetaById)]),
  )

  let scopedTreatmentIds: Set<number> | null = null
  if (selectedSpecialtyIds.length > 0) {
    scopedTreatmentIds = new Set(specialtyTreatmentIds)
  }
  if (selectedTreatmentIds.length > 0) {
    if (scopedTreatmentIds === null) {
      scopedTreatmentIds = new Set(selectedTreatmentIds)
    } else {
      scopedTreatmentIds = new Set(selectedTreatmentIds.filter((treatmentId) => scopedTreatmentIds?.has(treatmentId)))
    }
  }

  const buildRowsForSelectedCities = (cityIds: Set<number>) =>
    buildScopedClinicRows({
      clinics: ratingFilteredClinics,
      selectedCityIds: cityIds,
      treatmentScope: scopedTreatmentIds,
      presentationByClinicId,
      minPriceByTreatmentByClinicId,
    })

  const rowsBeforePrice = buildRowsForSelectedCities(selectedCityIds)

  const facetedPriceMax = rowsBeforePrice.reduce((maxValue, row) => {
    if (row.priceFrom === null) return maxValue
    return row.priceFrom > maxValue ? row.priceFrom : maxValue
  }, LISTING_COMPARISON_PRICE_MIN_DEFAULT)

  const priceBounds = {
    min: LISTING_COMPARISON_PRICE_MIN_DEFAULT,
    max: facetedPriceMax,
  }

  const effectivePriceMin = clamp(initialQueryState.priceMin, LISTING_COMPARISON_PRICE_MIN_DEFAULT, priceBounds.max)
  const requestedPriceMax = Number.isFinite(initialQueryState.priceMax) ? initialQueryState.priceMax : priceBounds.max
  const effectivePriceMax = clamp(Math.max(requestedPriceMax, effectivePriceMin), effectivePriceMin, priceBounds.max)

  const scopedRows = applyPriceWindow(rowsBeforePrice, effectivePriceMin, effectivePriceMax, priceBounds.max)

  const sortedRows = [...scopedRows].sort((left, right) => compareClinicRows(initialQueryState.sort, left, right))

  const totalResults = sortedRows.length
  const totalPages = Math.max(1, Math.ceil(totalResults / LISTING_COMPARISON_PER_PAGE))
  const page = Math.min(Math.max(initialQueryState.page, 1), totalPages)
  const pageStart = (page - 1) * LISTING_COMPARISON_PER_PAGE
  const pageRows = sortedRows.slice(pageStart, pageStart + LISTING_COMPARISON_PER_PAGE)

  const reviewCounts = await countApprovedReviewsByClinic(
    payload,
    pageRows.map((row) => row.clinic.id),
  )
  const mediaByClinicId = await buildClinicThumbnailDescriptorsByClinicId({
    payload,
    clinics: pageRows.map((row) => row.clinic),
  })

  const results = mapListingCardResults(pageRows, reviewCounts, {
    availableClinicMediaFiles,
    mediaByClinicId,
  })

  const cityFacetRows = applyPriceWindow(
    buildRowsForSelectedCities(new Set<number>()),
    effectivePriceMin,
    effectivePriceMax,
    priceBounds.max,
  )

  const cityOptionsWithCounts = buildCityFacetOptions({
    cityOptions,
    cityIdByValue,
    selectedCityValues,
    cityFacetRows,
  })

  const treatmentOptionsWithCounts = buildTreatmentFacetOptions({
    treatmentsMeta,
    specialtyOptions,
    selectedTreatmentIds: new Set(selectedTreatmentIds),
    selectedSpecialtyIds,
    specialtyTreatmentIds,
    ratingFilteredClinics,
    presentationByClinicId,
    selectedCityIds,
    minPriceByTreatmentByClinicId,
    effectivePriceMin,
    effectivePriceMax,
    priceBoundsMax: priceBounds.max,
    selectedTreatmentValues,
  })

  const queryState: ListingComparisonQueryState = {
    page,
    sort: initialQueryState.sort,
    cities: selectedCityValues,
    treatments: selectedTreatmentValues,
    specialties: selectedSpecialtyValues,
    ratingMin: initialQueryState.ratingMin,
    priceMin: effectivePriceMin,
    priceMax: effectivePriceMax,
  }

  const selectedSpecialties = selectedSpecialtyValues
    .map((value) => specialtyOptionByValue.get(value))
    .filter((specialty): specialty is NonNullable<typeof specialty> => Boolean(specialty))

  const selectedSpecialtyPath = buildSpecialtyPath(selectedSpecialtyIds[0] ?? null, specialtyById)
  const specialtyContext = {
    selected: selectedSpecialties,
    breadcrumbs: [
      HOME_BREADCRUMB,
      CLINICS_BREADCRUMB,
      ...selectedSpecialtyPath.map((specialty) => ({
        label: specialty.name,
        href: buildListingComparisonHref(
          {
            ...queryState,
            page: 1,
            specialties: [String(specialty.id)],
          },
          { priceMax: priceBounds.max },
        ),
      })),
    ],
  }

  return {
    results,
    filterOptions: {
      cities: cityOptionsWithCounts,
      specialties: specialtyOptions,
      treatments: treatmentOptionsWithCounts,
      waitTimes: [],
    },
    priceBounds,
    queryState,
    pagination: {
      page,
      perPage: LISTING_COMPARISON_PER_PAGE,
      totalPages,
      totalResults,
      totalAvailableResults,
    },
    specialtyContext,
    metrics: {
      verifiedClinics,
      treatmentTypes,
      cities,
      priceEntries,
    },
    freshness,
  }
}
