import { describe, expect, it } from 'vitest'

import type { Clinic } from '@/payload-types'
import { buildCityFacetOptions, buildTreatmentFacetOptions } from '@/utilities/listingComparison/serverData/facets'
import type {
  ClinicPresentationMeta,
  ClinicRow,
  FilterOption,
  TreatmentMeta,
} from '@/utilities/listingComparison/serverData/types'

function makeClinic(id: number, name: string): Clinic {
  return {
    id,
    name,
  } as unknown as Clinic
}

describe('listingComparison facet helpers', () => {
  it('city facets keep selected zero-count options while counting from city-agnostic rows', () => {
    const cityOptions: FilterOption[] = [
      { value: '1', label: 'Berlin' },
      { value: '2', label: 'Munich' },
    ]

    const cityRows: ClinicRow[] = [
      {
        clinic: makeClinic(1, 'Only Munich Result'),
        cityId: 2,
        location: 'Munich, Germany',
        priceFrom: 5000,
      },
    ]

    const result = buildCityFacetOptions({
      cityOptions,
      cityIdByValue: new Map([
        ['1', 1],
        ['2', 2],
      ]),
      selectedCityValues: ['1'],
      cityFacetRows: cityRows,
    })

    expect(result.map((option) => option.label)).toEqual(['Berlin (0)', 'Munich (1)'])
  })

  it('treatment facets ignore active treatment selection and retain selected zero-count options', () => {
    const treatmentsMeta: TreatmentMeta[] = [
      { id: 1, name: 'Nose job', slug: 'nose-job', medicalSpecialtyId: 10 },
      { id: 2, name: 'Breast augmentation', slug: 'breast-augmentation', medicalSpecialtyId: 10 },
    ]

    const clinics: Clinic[] = [makeClinic(101, 'Alpha'), makeClinic(102, 'Bravo')]

    const presentationByClinicId = new Map<number, ClinicPresentationMeta>([
      [101, { cityId: 1, location: 'Berlin, Germany' }],
      [102, { cityId: 2, location: 'Munich, Germany' }],
    ])

    const minPriceByTreatmentByClinicId = new Map<number, Map<number, number>>([
      [
        101,
        new Map([
          [1, 7000],
          [2, 5000],
        ]),
      ],
      [102, new Map([[1, 3000]])],
    ])

    const result = buildTreatmentFacetOptions({
      treatmentsMeta,
      selectedTreatmentIds: new Set([1]),
      selectedSpecialtyIds: [],
      specialtyTreatmentIds: new Set<number>(),
      availableTreatmentIdSet: new Set([1, 2]),
      ratingFilteredClinics: clinics,
      presentationByClinicId,
      selectedCityIds: new Set([1]),
      minPriceByTreatmentByClinicId,
      effectivePriceMin: 0,
      effectivePriceMax: 6000,
      priceBoundsMax: 7000,
      selectedTreatmentValues: ['1'],
    })

    expect(result.map((option) => option.label)).toEqual(['Breast augmentation (1)', 'Nose job (0)'])
  })
})
