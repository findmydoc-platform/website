import { describe, expect, it } from 'vitest'
import { ValidationError } from 'payload'

import { normalizeOpeningHoursTimeInput } from '@/app/(payload)/components/OpeningHoursTimeField/normalizeOpeningHoursTimeInput'
import { Clinics } from '@/collections/Clinics'

type FieldNode = {
  admin?: {
    components?: {
      Field?: string
    }
    description?: string
  }
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
    const validateClinic = Clinics.hooks?.beforeChange?.at(-1) as ((args: unknown) => unknown) | undefined
    const validContact = {
      firstName: 'Aylin',
      lastName: 'Korkmaz',
      email: 'aylin.korkmaz@example.com',
      role: 'Clinic Management',
    }

    expect(validateClinic).toBeTypeOf('function')
    if (!validateClinic) throw new Error('Expected clinic beforeChange hook')

    const runHook = async (args: unknown) => validateClinic(args)

    await expect(runHook({ data: { status: 'pending' }, operation: 'create' })).resolves.toEqual({
      status: 'pending',
    })
    const incompleteApproval = runHook({
      data: { status: 'approved' },
      operation: 'create',
    })

    await expect(incompleteApproval).rejects.toBeInstanceOf(ValidationError)
    await expect(incompleteApproval).rejects.toMatchObject({
      data: {
        errors: expect.arrayContaining([
          expect.objectContaining({ path: 'address.country' }),
          expect.objectContaining({ path: 'address.street' }),
          expect.objectContaining({ path: 'address.houseNumber' }),
          expect.objectContaining({ path: 'address.zipCode' }),
          expect.objectContaining({ path: 'address.city' }),
          expect.objectContaining({ path: 'internalPrimaryContact.firstName' }),
          expect.objectContaining({ path: 'internalPrimaryContact.lastName' }),
          expect.objectContaining({ path: 'internalPrimaryContact.email' }),
          expect.objectContaining({ path: 'internalPrimaryContact.role' }),
          expect.objectContaining({ path: 'supportedLanguages' }),
        ]),
      },
      status: 400,
    })
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
            zipCode: '10115',
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
            zipCode: '10115',
            city: 8,
          },
          internalPrimaryContact: validContact,
          status: 'approved',
          supportedLanguages: ['english'],
        },
      }),
    ).rejects.toMatchObject({
      data: {
        errors: expect.arrayContaining([
          expect.objectContaining({ path: 'internalPrimaryContact.firstName' }),
          expect.objectContaining({ path: 'internalPrimaryContact.lastName' }),
          expect.objectContaining({ path: 'internalPrimaryContact.email' }),
          expect.objectContaining({ path: 'internalPrimaryContact.role' }),
        ]),
      },
    })
  })
})

describe('Clinics opening-hours contract', () => {
  const openingHoursTimeField = '@/app/(payload)/components/OpeningHoursTimeField#OpeningHoursTimeField'

  const buildWeek = () => ({
    monday: { isClosed: false, opensAt: '09:00', closesAt: '17:00' },
    tuesday: { isClosed: false, opensAt: '09:00', closesAt: '17:00' },
    wednesday: { isClosed: false, opensAt: '09:00', closesAt: '17:00' },
    thursday: { isClosed: false, opensAt: '09:00', closesAt: '17:00' },
    friday: { isClosed: false, opensAt: '09:00', closesAt: '17:00' },
    saturday: { isClosed: false, opensAt: '10:00', closesAt: '14:00' },
    sunday: { isClosed: true, opensAt: null, closesAt: null },
  })

  it('keeps checkbox defaults unset and validates explicit seven-day schedules with actionable messages', () => {
    const openingHours = findFieldByName((Clinics.fields ?? []) as FieldNode[], 'openingHours')

    expect(openingHours?.type).toBe('group')
    expect(openingHours?.validate).toBeTypeOf('function')
    for (const day of openingHours?.fields ?? []) {
      expect(findFieldByName(day.fields, 'isClosed')?.defaultValue).toBeUndefined()
    }

    const validate = openingHours?.validate
    if (!validate) throw new Error('Expected opening-hours validator')

    expect(validate(buildWeek())).toBe(true)
    expect(validate({ monday: buildWeek().monday })).toBe('Opening hours must include tuesday.')
    expect(validate({ ...buildWeek(), monday: { isClosed: false, opensAt: '9:00', closesAt: '17:00' } })).toBe(
      'monday times must use the 24-hour HH:mm format.',
    )
    expect(validate({ ...buildWeek(), monday: { isClosed: false, opensAt: '09:00', closesAt: null } })).toBe(
      'monday requires both opening and closing times.',
    )
    expect(validate({ ...buildWeek(), monday: { isClosed: false, opensAt: '17:00', closesAt: '16:59' } })).toBe(
      'monday closing time must be later than opening time.',
    )
  })

  it.each([
    ['8', '08:00'],
    ['08', '08:00'],
    ['8:00', '08:00'],
    ['08:00', '08:00'],
    ['8:30', '08:30'],
    [' 8 ', '08:00'],
    ['0', '00:00'],
    ['00:00', '00:00'],
    ['23', '23:00'],
    ['23:59', '23:59'],
    ['   ', ''],
  ])('normalizes supported admin time input %j to %j', (input, expected) => {
    expect(normalizeOpeningHoursTimeInput(input)).toBe(expected)
  })

  it.each(['8:5', '800', '8.00', '24', '24:00', '08:60', 'morning'])(
    'leaves unsupported admin time input %j for Payload validation',
    (input) => {
      expect(normalizeOpeningHoursTimeInput(input)).toBeNull()
    },
  )

  it('uses the Payload time-field wrapper for opening and closing times on every day', () => {
    const openingHours = findFieldByName((Clinics.fields ?? []) as FieldNode[], 'openingHours')

    for (const day of openingHours?.fields ?? []) {
      for (const fieldName of ['opensAt', 'closesAt']) {
        const timeField = findFieldByName(day.fields, fieldName)

        expect(timeField?.admin?.components?.Field).toBe(openingHoursTimeField)
        expect(timeField?.admin?.description).toBe('Local time in 24-hour HH:mm format.')
      }
    }
  })
})
