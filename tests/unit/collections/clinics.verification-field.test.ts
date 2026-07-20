import { describe, expect, it } from 'vitest'

import { Clinics } from '@/collections/Clinics'

type FieldNode = {
  name?: string
  type?: string
  fields?: FieldNode[]
  tabs?: Array<{ label?: string; fields?: FieldNode[] }>
  defaultValue?: unknown
  options?: Array<{ label: string; value: string }>
  required?: boolean
  validate?: (value: unknown, options?: { operation?: 'create' | 'update'; previousValue?: unknown }) => true | string
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

  it('keeps internal primary contact fields optional before clinic approval', () => {
    const contactField = findFieldByName((Clinics.fields ?? []) as FieldNode[], 'internalPrimaryContact')

    expect(contactField).toBeTruthy()
    expect(contactField?.type).toBe('group')
    expect(contactField?.validate).toBeUndefined()
    for (const fieldName of ['firstName', 'lastName', 'email', 'role']) {
      expect(findFieldByName(contactField?.fields, fieldName)?.required).not.toBe(true)
    }
  })

  it('requires complete operational fields only when the clinic is approved', async () => {
    const validateClinic = Clinics.hooks?.beforeValidate?.[0] as ((args: unknown) => unknown) | undefined
    const validContact = {
      firstName: 'Aylin',
      lastName: 'Korkmaz',
      email: 'aylin.korkmaz@example.com',
      role: 'Clinic Management',
    }

    expect(validateClinic).toBeTypeOf('function')
    if (!validateClinic) throw new Error('Expected clinic beforeValidate hook')

    const runHook = async (args: unknown) => validateClinic(args)

    await expect(runHook({ data: { status: 'pending' }, operation: 'create' })).resolves.toEqual({
      status: 'pending',
    })
    await expect(
      runHook({
        data: { status: 'approved' },
        operation: 'create',
      }),
    ).rejects.toThrow(/complete address, internal primary contact, and at least one supported language/i)
    await expect(
      runHook({
        data: {
          name: 'Updated clinic',
        },
        operation: 'update',
        originalDoc: {
          address: {
            country: 'Germany',
            street: 'Clinic Street',
            houseNumber: '1',
            zipCode: 10115,
            city: 8,
          },
          internalPrimaryContact: validContact,
          status: 'approved',
          supportedLanguages: ['english'],
        },
      }),
    ).resolves.toEqual({ name: 'Updated clinic' })
    await expect(
      runHook({
        data: {
          name: 'Legacy clinic update',
        },
        operation: 'update',
        originalDoc: {},
      }),
    ).resolves.toEqual({ name: 'Legacy clinic update' })
    await expect(
      runHook({
        data: {
          internalPrimaryContact: null,
        },
        operation: 'update',
        originalDoc: {
          address: {
            country: 'Germany',
            street: 'Clinic Street',
            houseNumber: '1',
            zipCode: 10115,
            city: 8,
          },
          internalPrimaryContact: validContact,
          status: 'approved',
          supportedLanguages: ['english'],
        },
      }),
    ).rejects.toThrow(/complete address, internal primary contact, and at least one supported language/i)
  })
})
