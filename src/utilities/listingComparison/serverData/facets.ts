import type { Clinic } from '@/payload-types'
import { slugify } from '@/utilities/slugify'
import { LISTING_COMPARISON_PRICE_MIN_DEFAULT } from '@/utilities/listingComparison/queryState'
import type {
  CityMeta,
  ClinicPresentationMeta,
  ClinicRow,
  FilterOption,
  SpecialtyFilterOption,
  TreatmentFilterGroup,
  TreatmentMeta,
} from './types'

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

export function sortFilterOptions<T extends { label: string }>(options: T[]): T[] {
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
      const isSelected = selectedCityValueSet.has(option.value)

      return {
        value: option.value,
        label: `${option.label} (${count})`,
        disabled: count === 0 && !isSelected,
      }
    })
    .map(({ value, label, disabled }) => ({ value, label, disabled }))
}

export function buildTreatmentFacetOptions({
  treatmentsMeta,
  specialtyOptions,
  selectedTreatmentIds,
  selectedSpecialtyIds,
  specialtyTreatmentIds,
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
  specialtyOptions: SpecialtyFilterOption[]
  selectedTreatmentIds: Set<number>
  selectedSpecialtyIds: number[]
  specialtyTreatmentIds: Set<number>
  ratingFilteredClinics: Clinic[]
  presentationByClinicId: Map<number, ClinicPresentationMeta>
  selectedCityIds: Set<number>
  minPriceByTreatmentByClinicId: Map<number, Map<number, number>>
  effectivePriceMin: number
  effectivePriceMax: number
  priceBoundsMax: number
  selectedTreatmentValues: string[]
}): TreatmentFilterGroup[] {
  const treatmentFacetDomain = treatmentsMeta.filter((treatment) => {
    if (selectedTreatmentIds.has(treatment.id)) {
      return true
    }
    if (selectedSpecialtyIds.length > 0 && !specialtyTreatmentIds.has(treatment.id)) {
      return false
    }
    return true
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

  const optionsBySpecialtyValue = new Map<string, FilterOption[]>()

  const treatmentOptions = sortFilterOptions(
    treatmentFacetDomain.map((treatment) => ({
      value: String(treatment.id),
      label: treatment.name,
      specialtyValue: treatment.medicalSpecialtyId ? String(treatment.medicalSpecialtyId) : null,
    })),
  )
    .map((option) => {
      const count = treatmentCountsByValue.get(option.value) ?? 0
      const isSelected = selectedTreatmentValueSet.has(option.value)
      return {
        value: option.value,
        label: `${option.label} (${count})`,
        disabled: count === 0 && !isSelected,
        specialtyValue: option.specialtyValue,
      }
    })
    .map(({ value, label, disabled, specialtyValue }) => ({ value, label, disabled, specialtyValue }))

  treatmentOptions.forEach((option) => {
    if (!option.specialtyValue) return

    const siblingOptions = optionsBySpecialtyValue.get(option.specialtyValue) ?? []
    siblingOptions.push({
      value: option.value,
      label: option.label,
      disabled: option.disabled,
    })
    optionsBySpecialtyValue.set(option.specialtyValue, siblingOptions)
  })

  const orderedGroups: TreatmentFilterGroup[] = []

  specialtyOptions.forEach((specialtyOption) => {
    const options = optionsBySpecialtyValue.get(specialtyOption.value)
    if (!options || options.length === 0) return

    orderedGroups.push({
      specialty: specialtyOption,
      options,
    })
    optionsBySpecialtyValue.delete(specialtyOption.value)
  })

  optionsBySpecialtyValue.forEach((options, specialtyValue) => {
    orderedGroups.push({
      specialty: {
        value: specialtyValue,
        label: specialtyValue,
        depth: 0,
        parentValue: null,
      },
      options,
    })
  })

  return orderedGroups
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
