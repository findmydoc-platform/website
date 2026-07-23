import { describe, expect, it } from 'vitest'
import { ValidationError } from 'payload'

import { conditionalRequirementRegistry } from './conditionalRequirementRegistry'

type FieldNode = {
  admin?: { components?: { Error?: unknown; Field?: unknown }; description?: unknown }
  fields?: FieldNode[]
  name?: string
  required?: boolean
  tabs?: Array<{ fields?: FieldNode[] }>
  type?: string
  validate?: unknown
}

const findFieldByPath = (fields: FieldNode[] | undefined, targetPath: string, parentPath = ''): FieldNode | null => {
  if (!fields) return null

  for (const field of fields) {
    const fieldPath = field.name ? [parentPath, field.name].filter(Boolean).join('.') : parentPath
    if (field.name && fieldPath === targetPath) return field

    const nestedMatch = findFieldByPath(field.fields, targetPath, fieldPath)
    if (nestedMatch) return nestedMatch

    for (const tab of field.tabs ?? []) {
      const tabMatch = findFieldByPath(tab.fields, targetPath, fieldPath)
      if (tabMatch) return tabMatch
    }
  }

  return null
}

describe('Conditional requirement contracts', () => {
  it('keeps collection fields, Admin markers, and native validators aligned with registered rules', () => {
    const expectedErrorComponents = {
      clinics: '@/app/(payload)/components/ClinicApprovalRequirements#ClinicApprovalRequirementError',
      reviews: '@/app/(payload)/components/ReviewCreationRequirementError#ReviewCreationRequirementError',
    } as const
    const registeredRequirements = Object.values(conditionalRequirementRegistry).flatMap(
      ({ requirementSet }) => requirementSet.requirements,
    )

    expect(registeredRequirements).toHaveLength(11)

    for (const { collection, requirementSet } of Object.values(conditionalRequirementRegistry)) {
      expect(collection.slug).toBe(requirementSet.collection)

      for (const requirement of requirementSet.requirements) {
        const field = findFieldByPath(collection.fields as FieldNode[], requirement.path)

        expect(field, `${collection.slug}.${requirement.path}`).toBeTruthy()
        expect(field?.required, `${collection.slug}.${requirement.path} must remain conditional`).not.toBe(true)
        expect(field?.validate, `${collection.slug}.${requirement.path} needs native validation`).toBeTypeOf('function')
        expect(String(field?.admin?.description)).toContain(requirement.marker)
        expect(field?.admin?.components?.Error).toBe(
          expectedErrorComponents[collection.slug as keyof typeof expectedErrorComponents],
        )
      }
    }
  })

  it.each([
    ['clinics', { status: 'approved' }, 'create'],
    ['reviews', {}, 'create'],
  ] as const)(
    'returns registered field paths from the %s final validation hook',
    async (registryKey, data, operation) => {
      const contract = conditionalRequirementRegistry[registryKey]
      const hook = contract.finalValidationHook

      expect(hook).toBeTypeOf('function')
      if (!hook) throw new Error(`Missing final validation hook for ${registryKey}`)

      const result = Promise.resolve().then(() =>
        hook({
          collection: contract.collection,
          context: {},
          data,
          operation,
          originalDoc: undefined,
          req: {},
        } as never),
      )

      await expect(result).rejects.toBeInstanceOf(ValidationError)
      await expect(result).rejects.toMatchObject({
        data: {
          errors: contract.requirementSet.requirements.map((requirement) =>
            expect.objectContaining({ path: requirement.path }),
          ),
        },
        status: 400,
      })
    },
  )

  it('does not apply conditional hooks outside their lifecycle condition', async () => {
    const clinicHook = conditionalRequirementRegistry.clinics.finalValidationHook
    const reviewHook = conditionalRequirementRegistry.reviews.finalValidationHook

    if (!clinicHook || !reviewHook) throw new Error('Missing final conditional validation hooks')

    await expect(
      Promise.resolve(
        clinicHook({ data: { status: 'pending' }, operation: 'create', originalDoc: undefined } as never),
      ),
    ).resolves.toMatchObject({ status: 'pending' })
    await expect(
      Promise.resolve(reviewHook({ data: {}, operation: 'update', originalDoc: {} } as never)),
    ).resolves.toEqual({})
  })

  it('installs the collection-specific Admin checklist without duplicating the rules', () => {
    const clinicChecklist = findFieldByPath(
      conditionalRequirementRegistry.clinics.collection.fields as FieldNode[],
      'approvalRequirements',
    )

    expect(clinicChecklist?.admin?.components?.Field).toBe(
      '@/app/(payload)/components/ClinicApprovalRequirements#ClinicApprovalRequirements',
    )
  })
})
