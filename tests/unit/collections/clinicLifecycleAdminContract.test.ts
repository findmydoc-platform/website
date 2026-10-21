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

  it('exposes the conditional group requirement through field validation', async () => {
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

  it('returns the group field error in beforeValidate before assignment beforeChange can reject it generically', async () => {
    const validateConfiguredStage = async (
      data: Record<string, unknown>,
      originalDoc: Record<string, unknown> = { id: 11, assignmentScope: 'local', clinic: 34, group: null },
    ) => {
      let validated = data
      for (const hook of ClinicStaff.hooks?.beforeValidate ?? []) {
        validated =
          (await hook({
            data: validated,
            operation: 'update',
            originalDoc,
            req: {},
          } as never)) ?? validated
      }
      return validated
    }

    await expect(
      validateConfiguredStage({ assignmentScope: 'group', clinic: null, group: null }),
    ).rejects.toMatchObject({
      status: 400,
      data: {
        collection: 'clinicStaff',
        errors: [{ path: 'group', label: 'Group', message: 'Group is required for group scope.' }],
      },
    })
    for (const data of [
      { assignmentScope: 'group', clinic: null, group: 17 },
      { assignmentScope: 'unassigned', clinic: null, group: null },
      { assignmentScope: 'local', clinic: 34, group: null },
      { firstName: 'Updated' },
    ])
      await expect(validateConfiguredStage(data)).resolves.toEqual(data)
    await expect(
      validateConfiguredStage(
        { assignmentScope: 'group' },
        { id: 11, assignmentScope: 'group', clinic: null, group: 17 },
      ),
    ).resolves.toEqual({ assignmentScope: 'group' })
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
