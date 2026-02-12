import type { Clinic } from '@/payload-types'
import { slugify } from '@/utilities/slugify'
import { LISTING_COMPARISON_PRICE_MIN_DEFAULT } from '@/utilities/listingComparison/queryState'
import type { CityMeta, ClinicPresentationMeta, ClinicRow, FilterOption, TreatmentMeta } from './types'

/**
 * Facet utilities for listing-comparison filter options and counts.
 * They keep option values stable while deriving labels/counts from current in-memory scope.
 */
export function canonicalizeFilterValues(values: string[], options: FilterOption[]): string[] {
  if (values.length === 0) return []

  const byValue = new Map(options.map((option) => [option.value, option.value]))
  const bySlug = new Map(options.map((option) => [slugify(option.label), option.value]))
  const byLabel = new Map(options.map((option) => [option.label.trim().toLowerCase(), option.value]))

  const resolved = new Set<string>()
  values.forEach((value) => {
    const trimmed = value.trim()
    if (!trimmed) return

    const byExact = byValue.get(trimmed)
    if (byExact) {
      resolved.add(byExact)
      return
    }

    const slugValue = bySlug.get(slugify(trimmed))
    if (slugValue) {
      resolved.add(slugValue)
      return
    }

    const labelValue = byLabel.get(trimmed.toLowerCase())
    if (labelValue) {
      resolved.add(labelValue)
    }
  })

  return Array.from(resolved)
}

export function sortFilterOptions(options: FilterOption[]): FilterOption[] {
  return [...options].sort((a, b) => a.label.localeCompare(b.label))
}

export function buildCityFacetOptions({
  cityOptions,
  cityIdByValue,
  selectedCityValues,
  cityFacetRows,
}: {
  cityOptions: FilterOption[]
  cityIdByValue: Map<string, number>
  selectedCityValues: string[]
  cityFacetRows: ClinicRow[]
}): FilterOption[] {
  const cityCountsById = new Map<number, number>()
  cityFacetRows.forEach((row) => {
    if (!row.cityId) return
    cityCountsById.set(row.cityId, (cityCountsById.get(row.cityId) ?? 0) + 1)
  })

  const selectedCityValueSet = new Set(selectedCityValues)

  return cityOptions
    .map((option) => {
      const cityId = cityIdByValue.get(option.value)
      const count = typeof cityId === 'number' ? (cityCountsById.get(cityId) ?? 0) : 0

      return {
        value: option.value,
        label: `${option.label} (${count})`,
        count,
      }
    })
    .filter((option) => option.count > 0 || selectedCityValueSet.has(option.value))
    .map(({ value, label }) => ({ value, label }))
}

export function buildTreatmentFacetOptions({
  treatmentsMeta,
  selectedTreatmentIds,
  selectedSpecialtyIds,
  specialtyTreatmentIds,
  availableTreatmentIdSet,
  ratingFilteredClinics,
  presentationByClinicId,
  selectedCityIds,
  minPriceByTreatmentByClinicId,
  effectivePriceMin,
  effectivePriceMax,
  priceBoundsMax,
  selectedTreatmentValues,
}: {
  treatmentsMeta: TreatmentMeta[]
  selectedTreatmentIds: Set<number>
  selectedSpecialtyIds: number[]
  specialtyTreatmentIds: Set<number>
  availableTreatmentIdSet: Set<number>
  ratingFilteredClinics: Clinic[]
  presentationByClinicId: Map<number, ClinicPresentationMeta>
  selectedCityIds: Set<number>
  minPriceByTreatmentByClinicId: Map<number, Map<number, number>>
  effectivePriceMin: number
  effectivePriceMax: number
  priceBoundsMax: number
  selectedTreatmentValues: string[]
}): FilterOption[] {
  const treatmentFacetDomain = treatmentsMeta.filter((treatment) => {
    if (selectedTreatmentIds.has(treatment.id)) {
      return true
    }
    if (selectedSpecialtyIds.length > 0 && !specialtyTreatmentIds.has(treatment.id)) {
      return false
    }
    return availableTreatmentIdSet.has(treatment.id)
  })

  const treatmentFacetClinics = ratingFilteredClinics.filter((clinic) => {
    const cityId = presentationByClinicId.get(clinic.id)?.cityId
    if (selectedCityIds.size > 0 && (!cityId || !selectedCityIds.has(cityId))) {
      return false
    }
    return true
  })

  const hasExplicitPriceWindowFilter =
    effectivePriceMin > LISTING_COMPARISON_PRICE_MIN_DEFAULT || effectivePriceMax < priceBoundsMax

  const treatmentCountsByValue = new Map<string, number>()
  treatmentFacetDomain.forEach((treatment) => {
    if (selectedSpecialtyIds.length > 0 && !specialtyTreatmentIds.has(treatment.id)) {
      treatmentCountsByValue.set(String(treatment.id), 0)
      return
    }

    let count = 0
    treatmentFacetClinics.forEach((clinic) => {
      const priceByTreatment = minPriceByTreatmentByClinicId.get(clinic.id)
      const price = priceByTreatment?.get(treatment.id)
      if (typeof price !== 'number' || !Number.isFinite(price)) return
      if (hasExplicitPriceWindowFilter && (price < effectivePriceMin || price > effectivePriceMax)) return
      count += 1
    })

    treatmentCountsByValue.set(String(treatment.id), count)
  })

  const selectedTreatmentValueSet = new Set(selectedTreatmentValues)

  return sortFilterOptions(
    treatmentFacetDomain.map((treatment) => ({
      value: String(treatment.id),
      label: treatment.name,
    })),
  )
    .map((option) => {
      const count = treatmentCountsByValue.get(option.value) ?? 0
      return {
        value: option.value,
        label: `${option.label} (${count})`,
        count,
      }
    })
    .filter((option) => option.count > 0 || selectedTreatmentValueSet.has(option.value))
    .map(({ value, label }) => ({ value, label }))
}

export function toCityMetaFromDocs(cityDocs: Array<{ id: number; name: string }>): CityMeta[] {
  return cityDocs
    .map((city) => ({
      id: city.id,
      name: city.name,
      slug: slugify(city.name),
    }))
    .filter((city) => city.name.trim().length > 0)
}

export function toBaseFilterOptions<T extends { id: number; name: string }>(items: T[]): FilterOption[] {
  return sortFilterOptions(
    items.map((item) => ({
      value: String(item.id),
      label: item.name,
    })),
  )
}
