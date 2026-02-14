import type { Payload } from 'payload'

import type { Clinic } from '@/payload-types'
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

type FilterOptionValue = {
  value: string
  label: string
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
  const totalAvailableResults = approvedClinics.length
  const verifiedClinics = approvedClinics.filter((clinic) => isVerifiedClinic(clinic)).length
  const treatmentTypes = treatmentDocs.length

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
  const specialtyOptions = toBaseFilterOptions(specialtiesMeta)

  const selectedSpecialtyValues = resolveSelectedOptionValues({
    requestedValues: initialQueryState.specialties,
    legacyFallbackValue: parsed.legacy.service ?? undefined,
    options: specialtyOptions,
  })

  const specialtyById = new Map(specialtiesMeta.map((specialty) => [specialty.id, specialty]))
  const specialtyIdByValue = new Map(specialtiesMeta.map((specialty) => [String(specialty.id), specialty.id]))
  const selectedSpecialtyIds = resolveSelectedIdsFromOptions(selectedSpecialtyValues, specialtyIdByValue)
  const specialtyTree = buildSpecialtyTree(specialtiesMeta)
  const specialtyScope = collectDescendantSpecialties(selectedSpecialtyIds, specialtyTree)

  const treatmentsMeta: TreatmentMeta[] = treatmentDocs.map((treatment) => ({
    id: treatment.id,
    name: treatment.name,
    slug: slugify(treatment.name),
    medicalSpecialtyId: extractRelationId(treatment.medicalSpecialty),
  }))
  const allTreatmentOptions = toBaseFilterOptions(treatmentsMeta)

  const selectedTreatmentValues = resolveSelectedOptionValues({
    requestedValues: initialQueryState.treatments,
    legacyFallbackValue: parsed.legacy.service ?? undefined,
    options: allTreatmentOptions,
  })

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

  const ratingFilteredClinicIds = ratingFilteredClinics.map((clinic) => clinic.id)
  const clinicTreatments = await findClinicTreatmentsForClinics(payload, ratingFilteredClinicIds)

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

  const results = mapListingCardResults(pageRows, reviewCounts)

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
    .map((value) => specialtyIdByValue.get(value))
    .filter((id): id is number => typeof id === 'number')
    .map((id) => specialtyById.get(id))
    .filter((specialty): specialty is SpecialtyMeta => Boolean(specialty))
    .map((specialty) => ({ value: String(specialty.id), label: specialty.name }))

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
      totalAvailableResults,
    },
    specialtyContext,
    metrics: {
      verifiedClinics,
      treatmentTypes,
    },
  }
}
