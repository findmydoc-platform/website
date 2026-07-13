import type { FieldAccess } from 'payload'
import { describe, expect, test } from 'vitest'

import { Clinics } from '@/collections/Clinics'
import { Doctors } from '@/collections/Doctors'
import { Treatments } from '@/collections/Treatments'
import { createAccessArgs } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

type FieldNode = {
  name?: string
  fields?: FieldNode[]
  tabs?: Array<{ fields?: FieldNode[] }>
  access?: {
    create?: FieldAccess
    read?: FieldAccess
    update?: FieldAccess
  }
  admin?: {
    readOnly?: boolean
  }
}

const findFieldByName = (fields: FieldNode[] | undefined, name: string): FieldNode | null => {
  if (!fields) return null

  for (const field of fields) {
    if (field.name === name) return field

    const nestedField = findFieldByName(field.fields, name)
    if (nestedField) return nestedField

    for (const tab of field.tabs ?? []) {
      const tabField = findFieldByName(tab.fields, name)
      if (tabField) return tabField
    }
  }

  return null
}

const collections = [
  { slug: 'clinics', fields: Clinics.fields as FieldNode[] },
  { slug: 'doctors', fields: Doctors.fields as FieldNode[] },
  { slug: 'treatments', fields: Treatments.fields as FieldNode[] },
]

const roles = [
  { role: 'platform', user: () => mockUsers.platform() },
  { role: 'clinic', user: () => mockUsers.clinic() },
  { role: 'patient', user: () => mockUsers.patient() },
  { role: 'anonymous', user: () => mockUsers.anonymous() },
]

describe.each(collections)('$slug averageRating field', ({ fields }) => {
  const averageRatingField = findFieldByName(fields, 'averageRating')

  test.each(roles)('denies direct create and update writes for $role users', async ({ user }) => {
    expect(averageRatingField?.access?.create).toBeTypeOf('function')
    expect(averageRatingField?.access?.update).toBeTypeOf('function')

    expect(await averageRatingField?.access?.create?.(createAccessArgs(user()))).toBe(false)
    expect(await averageRatingField?.access?.update?.(createAccessArgs(user()))).toBe(false)
  })

  test('keeps reads unrestricted and the Admin field read-only', () => {
    expect(averageRatingField?.access?.read).toBeUndefined()
    expect(averageRatingField?.admin?.readOnly).toBe(true)
  })
})
