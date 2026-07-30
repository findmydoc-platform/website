import { describe, expect, it, vi } from 'vitest'

import { Clinics } from '@/collections/Clinics'
import { TURKIYE_ISO_CODE } from '@/collections/clinics/turkiyeAddress'

type FieldNode = {
  fields?: FieldNode[]
  filterOptions?: (args: unknown) => unknown
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

describe('Clinics Türkiye address contract', () => {
  it('stores the clinic country as a Countries relationship limited to ISO TR', async () => {
    const countryField = findFieldByName(Clinics.fields as FieldNode[], 'country')

    expect(countryField).toMatchObject({
      type: 'relationship',
      relationTo: 'countries',
    })
    expect(countryField?.filterOptions?.({})).toEqual({
      isoCode: {
        equals: TURKIYE_ISO_CODE,
      },
    })
  })

  it('limits the clinic city relationship picker to cities belonging to ISO TR countries', async () => {
    const cityField = findFieldByName(Clinics.fields as FieldNode[], 'city')
    const find = vi.fn().mockResolvedValue({
      docs: [{ id: 11 }, { id: 12 }],
    })

    const filter = await cityField?.filterOptions?.({
      req: {
        payload: {
          find,
        },
      },
    })

    expect(filter).toEqual({
      country: {
        in: [11, 12],
      },
    })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'countries',
        where: {
          isoCode: {
            equals: TURKIYE_ISO_CODE,
          },
        },
      }),
    )
  })
})
