import { describe, expect, it } from 'vitest'

import { Clinics } from '@/collections/Clinics'

type FieldNode = {
  access?: {
    create?: (args: { req: { user: unknown } }) => boolean
    update?: (args: { req: { user: unknown } }) => boolean
  }
  fields?: FieldNode[]
  name?: string
  relationTo?: string
  tabs?: Array<{ fields?: FieldNode[] }>
  type?: string
}

const findFieldByName = (fields: FieldNode[] | undefined, name: string): FieldNode | null => {
  for (const field of fields ?? []) {
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

describe('Clinics country field', () => {
  it('stores country as a platform-owned Countries relationship', () => {
    const countryField = findFieldByName(Clinics.fields as FieldNode[], 'country')
    const platformUser = { collection: 'platformStaff', id: 1 }
    const clinicUser = { collection: 'clinicStaff', id: 2 }

    expect(countryField).toMatchObject({
      type: 'relationship',
      relationTo: 'countries',
    })
    expect(countryField?.access?.create?.({ req: { user: platformUser } })).toBe(true)
    expect(countryField?.access?.update?.({ req: { user: platformUser } })).toBe(true)
    expect(countryField?.access?.create?.({ req: { user: clinicUser } })).toBe(false)
    expect(countryField?.access?.update?.({ req: { user: clinicUser } })).toBe(false)
  })
})
