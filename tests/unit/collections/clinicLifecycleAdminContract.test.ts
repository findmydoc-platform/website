import { describe, expect, it } from 'vitest'
import { ValidationError } from 'payload'

import { ClinicApplications } from '@/collections/ClinicApplications'
import { ClinicStaff } from '@/collections/ClinicStaff'
import { clinicStaffStatusOptions } from '@/collections/clinicStaff/lifecycle'
import { validateClinicStaffStatusTransition } from '@/hooks/clinicStaffLifecycle'

type FieldNode = {
  admin?: { components?: { Field?: unknown }; readOnly?: boolean }
  name?: string
  options?: unknown
  type?: string
}

const getField = (fields: FieldNode[], name: string): FieldNode | undefined =>
  fields.find((field) => field.name === name)

describe('Clinic lifecycle Admin contract', () => {
  it('installs the shared status options, filtered status field, and collection panels', () => {
    const staffFields = ClinicStaff.fields as FieldNode[]
    const applicationFields = ClinicApplications.fields as FieldNode[]

    expect(getField(staffFields, 'status')?.options).toBe(clinicStaffStatusOptions)
    expect(getField(staffFields, 'status')?.admin?.components?.Field).toBe(
      '@/app/(payload)/components/ClinicStaffLifecycle#ClinicStaffStatusField',
    )
    expect(getField(staffFields, 'lifecycleGuidance')?.admin?.components?.Field).toBe(
      '@/app/(payload)/components/ClinicStaffLifecycle#ClinicStaffLifecyclePanel',
    )
    expect(getField(applicationFields, 'lifecycleGuidance')?.admin?.components?.Field).toBe(
      '@/app/(payload)/components/ClinicApplicationLifecycle#ClinicApplicationLifecyclePanel',
    )
  })

  it('returns a structured status field error for a forbidden API transition', async () => {
    const result = validateClinicStaffStatusTransition({
      data: { status: 'rejected' },
      operation: 'update',
      originalDoc: { id: 12, status: 'approved' },
      req: {},
    } as never)

    await expect(result).rejects.toBeInstanceOf(ValidationError)
    await expect(result).rejects.toMatchObject({
      data: {
        errors: [
          expect.objectContaining({
            path: 'status',
          }),
        ],
      },
      status: 400,
    })
  })
})
