import { describe, expect, it } from 'vitest'

import { Clinics } from '@/collections/Clinics'

type FieldNode = {
  name?: string
  type?: string
  fields?: FieldNode[]
  tabs?: Array<{ label?: string; fields?: FieldNode[] }>
  defaultValue?: unknown
  options?: Array<{ label: string; value: string }>
}

function findFieldByName(fields: FieldNode[] | undefined, name: string): FieldNode | null {
  if (!fields) return null

  for (const field of fields) {
    if (field.name === name) {
      return field
    }

    const nestedFields = findFieldByName(field.fields, name)
    if (nestedFields) {
      return nestedFields
    }

    if (field.tabs) {
      for (const tab of field.tabs) {
        const tabMatch = findFieldByName(tab.fields, name)
        if (tabMatch) {
          return tabMatch
        }
      }
    }
  }

  return null
}

describe('Clinics collection verification field', () => {
  it('defines verification select with expected default and options', () => {
    const verificationField = findFieldByName((Clinics.fields ?? []) as FieldNode[], 'verification')

    expect(verificationField).toBeTruthy()
    expect(verificationField?.type).toBe('select')
    expect(verificationField?.defaultValue).toBe('unverified')
    expect(verificationField?.options).toEqual([
      { label: 'Unverified', value: 'unverified' },
      { label: 'Bronze', value: 'bronze' },
      { label: 'Silver', value: 'silver' },
      { label: 'Gold', value: 'gold' },
    ])
  })
})
