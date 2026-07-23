import { describe, expect, it } from 'vitest'

import { Doctors } from '@/collections/Doctors'
import { buildDoctorProfileImageFilter } from '@/collections/doctors/profileImageEligibility'
import { MedicalSpecialties } from '@/collections/MedicalSpecialties'
import { buildMedicalSpecialtyParentFilter } from '@/collections/MedicalSpecialties/parentEligibility'

type FieldNode = {
  admin?: {
    components?: {
      Field?: unknown
    }
  }
  fields?: FieldNode[]
  filterOptions?: (args: Record<string, unknown>) => unknown
  name?: string
  tabs?: Array<{ fields?: FieldNode[] }>
}

const findField = (fields: FieldNode[] | undefined, name: string): FieldNode | null => {
  if (!fields) return null

  for (const field of fields) {
    if (field.name === name) return field

    const nestedMatch = findField(field.fields, name)
    if (nestedMatch) return nestedMatch

    for (const tab of field.tabs ?? []) {
      const tabMatch = findField(tab.fields, name)
      if (tabMatch) return tabMatch
    }
  }

  return null
}

describe('dynamic relationship eligibility', () => {
  it('offers profile images only after the doctor exists and from the same doctor and clinic', () => {
    expect(buildDoctorProfileImageFilter({ clinicId: 4, doctorId: undefined })).toBe(false)
    expect(buildDoctorProfileImageFilter({ clinicId: 4, doctorId: 9 })).toEqual({
      and: [{ doctor: { equals: '9' } }, { clinic: { equals: '4' } }],
    })

    const field = findField(Doctors.fields as FieldNode[], 'profileImage')
    expect(field?.filterOptions).toBeTypeOf('function')
    expect(field?.filterOptions?.({ data: { clinic: 4 }, id: undefined })).toBe(false)
    expect(field?.filterOptions?.({ data: { clinic: 4 }, id: 9 })).toEqual({
      and: [{ doctor: { equals: '9' } }, { clinic: { equals: '4' } }],
    })
  })

  it('offers only top-level specialties and excludes the current record', () => {
    expect(buildMedicalSpecialtyParentFilter(undefined)).toEqual({ parentSpecialty: { exists: false } })
    expect(buildMedicalSpecialtyParentFilter(18)).toEqual({
      and: [{ parentSpecialty: { exists: false } }, { id: { not_equals: 18 } }],
    })

    const field = findField(MedicalSpecialties.fields as FieldNode[], 'parentSpecialty')
    expect(field?.filterOptions).toBeTypeOf('function')
    expect(field?.filterOptions?.({ id: 18 })).toEqual({
      and: [{ parentSpecialty: { exists: false } }, { id: { not_equals: 18 } }],
    })
  })
})
