import { describe, expect, it } from 'vitest'

import medicalSpecialties from '@/endpoints/seed/data/baseline/medicalSpecialties.json'
import treatments from '@/endpoints/seed/data/baseline/treatments.json'
import doctorSpecialties from '@/endpoints/seed/data/demo/doctorSpecialties.json'
import { medicalSpecialtyIconOptions } from '@/utilities/medicalSpecialties/iconKeys'

type MedicalSpecialtySeed = {
  iconKey: string
  stableId: string
  name: string
  parentSpecialtyStableId?: string
}

type TreatmentSeed = {
  stableId: string
  medicalSpecialtyStableId: string
}

type DoctorSpecialtySeed = {
  stableId: string
  medicalSpecialtyStableId: string
}

const LEVEL3_EXCLUSION_NAMES = new Set([
  'all-on-4',
  'all-on-6',
  'all-on-4 / all-on-6',
  'all-on-4/all-on-6',
  'eyebrow transplant',
  'beard transplant',
  'eyelid surgery',
  'hollywood smile',
])

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

describe('medical specialty seed permittierung', () => {
  const specialties = medicalSpecialties as MedicalSpecialtySeed[]
  const treatmentSeeds = treatments as TreatmentSeed[]
  const doctorSpecialtySeeds = doctorSpecialties as DoctorSpecialtySeed[]
  const specialtiesByStableId = new Map(specialties.map((entry) => [entry.stableId, entry]))
  const validIconKeys = new Set<string>(medicalSpecialtyIconOptions.map((option) => option.value))

  it('contains only level 1 and level 2 specialty hierarchy', () => {
    specialties.forEach((specialty) => {
      if (!specialty.parentSpecialtyStableId) return

      const parent = specialtiesByStableId.get(specialty.parentSpecialtyStableId)
      expect(parent, `Missing parent for ${specialty.stableId}`).toBeDefined()
      expect(parent?.parentSpecialtyStableId ?? null, `Level 3+ hierarchy found at ${specialty.stableId}`).toBeNull()
    })
  })

  it('keeps excluded level 3 candidate names out of medical specialties', () => {
    const excludedEntries = specialties.filter((specialty) => LEVEL3_EXCLUSION_NAMES.has(normalizeName(specialty.name)))
    expect(excludedEntries).toEqual([])
  })

  it('maps every treatment to an existing specialty stableId', () => {
    treatmentSeeds.forEach((treatment) => {
      const specialty = specialtiesByStableId.get(treatment.medicalSpecialtyStableId)
      expect(
        specialtiesByStableId.has(treatment.medicalSpecialtyStableId),
        `Unknown specialty ${treatment.medicalSpecialtyStableId} for treatment ${treatment.stableId}`,
      ).toBe(true)
      expect(
        specialty?.parentSpecialtyStableId,
        `Treatment ${treatment.stableId} must point to an L2 specialty, but got ${treatment.medicalSpecialtyStableId}`,
      ).toBeTruthy()
    })
  })

  it('maps every demo doctor specialty to an existing specialty stableId', () => {
    doctorSpecialtySeeds.forEach((doctorSpecialty) => {
      const specialty = specialtiesByStableId.get(doctorSpecialty.medicalSpecialtyStableId)
      expect(
        specialtiesByStableId.has(doctorSpecialty.medicalSpecialtyStableId),
        `Unknown specialty ${doctorSpecialty.medicalSpecialtyStableId} for doctor specialty ${doctorSpecialty.stableId}`,
      ).toBe(true)
      expect(
        specialty?.parentSpecialtyStableId,
        `Doctor specialty ${doctorSpecialty.stableId} must point to an L2 specialty, but got ${doctorSpecialty.medicalSpecialtyStableId}`,
      ).toBeTruthy()
    })
  })

  it('assigns a valid iconKey to every specialty', () => {
    specialties.forEach((specialty) => {
      expect(validIconKeys.has(specialty.iconKey), `Unknown iconKey for ${specialty.stableId}`).toBe(true)
    })
  })

  it('keeps child specialty icons aligned with their parent category', () => {
    specialties.forEach((specialty) => {
      if (!specialty.parentSpecialtyStableId) return

      const parent = specialtiesByStableId.get(specialty.parentSpecialtyStableId)
      expect(parent, `Missing parent for ${specialty.stableId}`).toBeDefined()
      expect(specialty.iconKey).toBe(parent?.iconKey)
    })
  })
})
