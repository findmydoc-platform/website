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
  validate?: (value: unknown) => true | string
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

  it('requires an internal primary contact object with all contact fields', () => {
    const contactField = findFieldByName((Clinics.fields ?? []) as FieldNode[], 'internalPrimaryContact')

    expect(contactField).toBeTruthy()
    expect(contactField?.type).toBe('group')
    expect(contactField?.required).toBe(true)

    const validate = contactField?.validate
    expect(validate).toBeTypeOf('function')
    if (!validate) throw new Error('Expected internal primary contact validation')

    expect(validate(null)).toBe('Internal primary contact is required.')
    expect(validate({})).toBe('Internal primary contact is required.')
    expect(
      validate({
        firstName: 'Aylin',
        lastName: 'Korkmaz',
        email: ' ',
        role: 'Clinic Management',
      }),
    ).toBe('Internal primary contact is required.')
    expect(
      validate({
        firstName: 'Aylin',
        lastName: 'Korkmaz',
        email: 'aylin.korkmaz@example.com',
        role: 'Clinic Management',
      }),
    ).toBe(true)
  })

  it('rejects clinic writes without a complete internal primary contact before validation', async () => {
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

    await expect(runHook({ data: {}, operation: 'create' })).rejects.toThrow('Internal primary contact is required.')
    await expect(
      runHook({
        data: {
          internalPrimaryContact: {
            firstName: null,
            lastName: null,
            email: null,
            role: null,
          },
        },
        operation: 'create',
      }),
    ).rejects.toThrow('Internal primary contact is required.')
    await expect(
      runHook({
        data: {
          name: 'Updated clinic',
        },
        operation: 'update',
        originalDoc: {
          internalPrimaryContact: validContact,
        },
      }),
    ).resolves.toEqual({ name: 'Updated clinic' })
  })
})
