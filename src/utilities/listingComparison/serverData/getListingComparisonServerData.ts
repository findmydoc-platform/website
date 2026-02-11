import type { Payload } from 'payload'

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
  findAllApprovedClinics,
  findAllCities,
  findAllSpecialties,
  findAllTreatments,
  findClinicTreatmentsForClinics,
} from './repositories'
import { buildSpecialtyTree, collectDescendantSpecialties } from './specialtyScope'
import type { ListingComparisonServerData, SpecialtyMeta, TreatmentMeta } from './types'

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

  const [cityDocs, treatmentDocs, specialtyDocs, approvedClinics] = await Promise.all([
    findAllCities(payload),
    findAllTreatments(payload),
    findAllSpecialties(payload),
    findAllApprovedClinics(payload),
  ])

  const cityMeta = toCityMetaFromDocs(cityDocs)
  const cityOptions = toBaseFilterOptions(cityMeta)

  let selectedCityStableIds = canonicalizeFilterValues(initialQueryState.cities, cityOptions)
  if (selectedCityStableIds.length === 0 && parsed.legacy.location) {
    selectedCityStableIds = canonicalizeFilterValues([parsed.legacy.location], cityOptions)
  }

  const cityIdByStableId = new Map(cityMeta.map((city) => [city.stableId, city.id]))
  const cityMetaById = new Map(cityMeta.map((city) => [city.id, city]))
  const selectedCityIds = new Set(
    selectedCityStableIds
      .map((stableId) => cityIdByStableId.get(stableId))
      .filter((id): id is number => typeof id === 'number'),
  )

  const specialtiesMeta: SpecialtyMeta[] = specialtyDocs.map((specialty) => ({
    id: specialty.id,
    stableId: specialty.stableId ?? String(specialty.id),
    name: specialty.name,
    slug: slugify(specialty.name),
    parentId: extractRelationId(specialty.parentSpecialty),
  }))
  const specialtyOptions = toBaseFilterOptions(specialtiesMeta)

  let selectedSpecialtyStableIds = canonicalizeFilterValues(initialQueryState.specialties, specialtyOptions)
  if (selectedSpecialtyStableIds.length === 0 && parsed.legacy.service) {
    selectedSpecialtyStableIds = canonicalizeFilterValues([parsed.legacy.service], specialtyOptions)
  }

  const specialtyByStableId = new Map(specialtiesMeta.map((specialty) => [specialty.stableId, specialty]))
  const selectedSpecialtyIds = selectedSpecialtyStableIds
    .map((stableId) => specialtyByStableId.get(stableId)?.id)
    .filter((id): id is number => typeof id === 'number')
  const specialtyTree = buildSpecialtyTree(specialtiesMeta)
  const specialtyScope = collectDescendantSpecialties(selectedSpecialtyIds, specialtyTree)

  const treatmentsMeta: TreatmentMeta[] = treatmentDocs.map((treatment) => ({
    id: treatment.id,
    stableId: treatment.stableId ?? String(treatment.id),
    name: treatment.name,
    slug: slugify(treatment.name),
    medicalSpecialtyId: extractRelationId(treatment.medicalSpecialty),
  }))
  const allTreatmentOptions = toBaseFilterOptions(treatmentsMeta)

  let selectedTreatmentStableIds = canonicalizeFilterValues(initialQueryState.treatments, allTreatmentOptions)
  if (selectedTreatmentStableIds.length === 0 && parsed.legacy.service) {
    selectedTreatmentStableIds = canonicalizeFilterValues([parsed.legacy.service], allTreatmentOptions)
  }

  const knownTreatmentStableIds = new Set(allTreatmentOptions.map((option) => option.value))
  selectedTreatmentStableIds = selectedTreatmentStableIds.filter((stableId) => knownTreatmentStableIds.has(stableId))

  const treatmentByStableId = new Map(treatmentsMeta.map((treatment) => [treatment.stableId, treatment]))
  const selectedTreatmentIds = selectedTreatmentStableIds
    .map((stableId) => treatmentByStableId.get(stableId)?.id)
    .filter((id): id is number => typeof id === 'number')

  const specialtyTreatmentIds = new Set<number>()
  if (specialtyScope.size > 0) {
    treatmentsMeta.forEach((treatment) => {
      if (treatment.medicalSpecialtyId && specialtyScope.has(treatment.medicalSpecialtyId)) {
        specialtyTreatmentIds.add(treatment.id)
      }
    })
  }

  const ratingFilteredClinics = approvedClinics.filter((clinic) => {
    if (initialQueryState.ratingMin !== null) {
      const rating = clinic.averageRating ?? 0
      if (rating < initialQueryState.ratingMin) {
        return false
      }
    }

    return true
  })

  const ratingFilteredClinicIds = ratingFilteredClinics.map((clinic) => clinic.id)
  const clinicTreatments = await findClinicTreatmentsForClinics(payload, ratingFilteredClinicIds)

  const availableTreatmentIdSet = new Set<number>()
  const minPriceByTreatmentByClinicId = new Map<number, Map<number, number>>()

  clinicTreatments.forEach((entry) => {
    const clinicId = extractRelationId(entry.clinic)
    const treatmentId = extractRelationId(entry.treatment)
    const price = entry.price
    if (!clinicId || !treatmentId || typeof price !== 'number' || !Number.isFinite(price)) return

    availableTreatmentIdSet.add(treatmentId)

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

  const rowsBeforePrice = buildScopedClinicRows({
    clinics: ratingFilteredClinics,
    selectedCityIds,
    treatmentScope: scopedTreatmentIds,
    presentationByClinicId,
    minPriceByTreatmentByClinicId,
  })

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

  const results = mapListingCardResults(pageRows, reviewCounts)

  const cityFacetRows = applyPriceWindow(
    buildScopedClinicRows({
      clinics: ratingFilteredClinics,
      selectedCityIds: new Set<number>(),
      treatmentScope: scopedTreatmentIds,
      presentationByClinicId,
      minPriceByTreatmentByClinicId,
    }),
    effectivePriceMin,
    effectivePriceMax,
    priceBounds.max,
  )

  const cityOptionsWithCounts = buildCityFacetOptions({
    cityOptions,
    cityIdByStableId,
    selectedCityStableIds,
    cityFacetRows,
  })

  const treatmentOptionsWithCounts = buildTreatmentFacetOptions({
    treatmentsMeta,
    selectedTreatmentIds: new Set(selectedTreatmentIds),
    selectedSpecialtyIds,
    specialtyTreatmentIds,
    availableTreatmentIdSet,
    ratingFilteredClinics,
    presentationByClinicId,
    selectedCityIds,
    minPriceByTreatmentByClinicId,
    effectivePriceMin,
    effectivePriceMax,
    priceBoundsMax: priceBounds.max,
    selectedTreatmentStableIds,
  })

  const queryState: ListingComparisonQueryState = {
    page,
    sort: initialQueryState.sort,
    cities: selectedCityStableIds,
    treatments: selectedTreatmentStableIds,
    specialties: selectedSpecialtyStableIds,
    ratingMin: initialQueryState.ratingMin,
    priceMin: effectivePriceMin,
    priceMax: effectivePriceMax,
  }

  const selectedSpecialties = selectedSpecialtyStableIds
    .map((stableId) => specialtyByStableId.get(stableId))
    .filter((specialty): specialty is SpecialtyMeta => Boolean(specialty))
    .map((specialty) => ({ value: specialty.stableId, label: specialty.name }))

  const primarySpecialty = selectedSpecialties[0]
  const specialtyContext = {
    selected: selectedSpecialties,
    breadcrumbs: primarySpecialty
      ? [
          { label: 'Home', href: '/' },
          { label: 'Clinics', href: '/listing-comparison' },
          {
            label: primarySpecialty.label,
            href: buildListingComparisonHref(
              {
                ...queryState,
                page: 1,
                specialties: [primarySpecialty.value],
              },
              { priceMax: priceBounds.max },
            ),
          },
        ]
      : [],
  }

  return {
    results,
    filterOptions: {
      cities: cityOptionsWithCounts,
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
    },
    specialtyContext,
  }
}
