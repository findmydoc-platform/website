import { describe, expect, it } from 'vitest'
import { ValidationError, type RelationshipFieldSingleValidation } from 'payload'

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

  it('requires a group in native field validation only for group assignments', async () => {
    const field = ClinicStaff.fields.find((entry) => 'name' in entry && entry.name === 'group')
    if (!field || field.type !== 'relationship' || typeof field.validate !== 'function')
      throw new Error('Expected group relationship validation.')
    const validate = field.validate as RelationshipFieldSingleValidation
    const options = {
      data: { assignmentScope: 'group' },
      siblingData: { assignmentScope: 'group' },
      relationTo: 'clinicGroups',
      required: false,
      req: {
        t: (key: string) => key,
        payload: {
          collections: { clinicGroups: { customIDType: 'number' } },
          config: { collections: [] },
          db: { defaultIDType: 'number' },
        },
      },
    }
    await expect(validate(null, options as never)).resolves.toBe('Group is required for group scope.')
    await expect(validate(17, options as never)).resolves.toBe(true)
    for (const scope of ['local', 'unassigned']) {
      await expect(validate(null, { ...options, data: { assignmentScope: scope } } as never)).resolves.toBe(true)
    }
    expect(field.admin?.description).toContain('Required for group scope.')
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
