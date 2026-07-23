import type { Validate } from 'payload'
import { validations } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { createConditionalRequiredValidator } from '@/collections/common/conditionalRequirements'
import { clinicApprovalRequirements, clinicApprovalRequirementSet } from '@/collections/clinics/approvalRequirements'

const translate = (key: string) => key

const baseOptions = {
  data: { status: 'approved' },
  event: 'onChange',
  operation: 'create',
  req: {
    payload: {
      collections: {
        cities: { customIDType: 'number' },
      },
      config: { collections: [] },
      db: { defaultIDType: 'number' },
    },
    t: translate,
  },
  required: false,
  siblingData: {},
}

type GenericValidate = Validate<unknown, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>

describe('createConditionalRequiredValidator', () => {
  it('returns the standard validator result before checking the conditional requirement', async () => {
    const baseValidate = vi.fn().mockReturnValue('Standard validation failed.')
    const valueIsPresent = vi.spyOn(clinicApprovalRequirements.country, 'valueIsPresent')
    const validator = createConditionalRequiredValidator(
      baseValidate,
      clinicApprovalRequirementSet,
      clinicApprovalRequirements.country,
    )

    await expect(validator('', baseOptions as never)).resolves.toBe('Standard validation failed.')
    expect(baseValidate).toHaveBeenCalledOnce()
    expect(valueIsPresent).not.toHaveBeenCalled()

    valueIsPresent.mockRestore()
  })

  it.each([
    {
      baseValidate: validations.email,
      expected: 'validation:emailAddress',
      options: baseOptions,
      requirement: clinicApprovalRequirements.contactEmail,
      value: 'invalid-email',
    },
    {
      baseValidate: validations.number,
      expected: 'validation:enterNumber',
      options: baseOptions,
      requirement: clinicApprovalRequirements.zipCode,
      value: 'not-a-number',
    },
    {
      baseValidate: validations.select,
      expected: 'validation:invalidSelection',
      options: { ...baseOptions, hasMany: true, options: ['english'] },
      requirement: clinicApprovalRequirements.supportedLanguages,
      value: ['not-a-language'],
    },
    {
      baseValidate: validations.relationship,
      expected: expect.stringContaining('invalid relationships'),
      options: { ...baseOptions, relationTo: 'cities' },
      requirement: clinicApprovalRequirements.city,
      value: 'not-a-city-id',
    },
  ])(
    'preserves Payload standard validation for $expected',
    async ({ baseValidate, expected, options, requirement, value }) => {
      const validator = createConditionalRequiredValidator(
        baseValidate as GenericValidate,
        clinicApprovalRequirementSet,
        requirement,
      )

      await expect(validator(value, options as never)).resolves.toEqual(expected)
    },
  )

  it('checks the conditional requirement after standard validation succeeds', async () => {
    const validator = createConditionalRequiredValidator(
      vi.fn().mockReturnValue(true),
      clinicApprovalRequirementSet,
      clinicApprovalRequirements.country,
    )

    await expect(validator('', baseOptions as never)).resolves.toBe(clinicApprovalRequirements.country.message)
    await expect(validator('', { ...baseOptions, data: { status: 'pending' } } as never)).resolves.toBe(true)
  })
})
