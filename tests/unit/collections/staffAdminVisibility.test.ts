import type { FieldAccess } from 'payload'
import { describe, expect, it } from 'vitest'

import { ClinicStaff } from '@/collections/ClinicStaff'
import { PlatformStaff } from '@/collections/PlatformStaff'
import { createAccessArgs, type TestUser } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

type FieldNode = {
  name?: string
  type?: string
  access?: {
    read?: FieldAccess
  }
  admin?: {
    hidden?: boolean
    readOnly?: boolean
    components?: {
      Field?: unknown
    }
  }
}

const safeProfileFields = ['email', 'firstName', 'lastName', 'profileImage'] as const

const findField = (fields: FieldNode[], name: string) => fields.find((field) => field.name === name)

const expectFieldRead = async (field: FieldNode | undefined, user: TestUser, expected: boolean) => {
  expect(field?.access?.read).toBeTypeOf('function')
  expect(await field?.access?.read?.(createAccessArgs(user))).toBe(expected)
}

describe('staff Admin identity visibility', () => {
  const platformFields = PlatformStaff.fields as FieldNode[]
  const clinicFields = ClinicStaff.fields as FieldNode[]

  it('registers prominent provisioning guidance on staff lists and documents', () => {
    expect(PlatformStaff.admin?.components?.beforeList).toContain(
      '@/components/organisms/StaffAdminGuidance#PlatformStaffAdminGuidance',
    )
    expect(ClinicStaff.admin?.components?.beforeList).toContain(
      '@/components/organisms/StaffAdminGuidance#ClinicStaffAdminGuidance',
    )

    expect(findField(platformFields, 'provisioningGuidance')?.admin?.components?.Field).toBe(
      '@/components/organisms/StaffAdminGuidance#PlatformStaffAdminGuidance',
    )
    expect(findField(clinicFields, 'provisioningGuidance')?.admin?.components?.Field).toBe(
      '@/components/organisms/StaffAdminGuidance#ClinicStaffAdminGuidance',
    )
  })

  it('shows safe platform identity fields only to platform staff', async () => {
    for (const name of safeProfileFields) {
      const field = findField(platformFields, name)

      expect(field?.admin?.hidden).not.toBe(true)
      expect(field?.admin?.readOnly).toBe(true)
      await expectFieldRead(field, mockUsers.platform(), true)
      await expectFieldRead(field, mockUsers.clinic(), false)
      await expectFieldRead(field, mockUsers.patient(), false)
      await expectFieldRead(field, mockUsers.anonymous(), false)
    }
  })

  it('shows safe clinic identity fields to scoped staff readers', async () => {
    for (const name of safeProfileFields) {
      const field = findField(clinicFields, name)

      expect(field?.admin?.hidden).not.toBe(true)
      expect(field?.admin?.readOnly).toBe(true)
      await expectFieldRead(field, mockUsers.platform(), true)
      await expectFieldRead(field, mockUsers.clinic(), true)
      await expectFieldRead(field, mockUsers.patient(), false)
      await expectFieldRead(field, mockUsers.anonymous(), false)
    }
  })

  it('keeps Supabase identity bindings private and hidden', async () => {
    for (const fields of [platformFields, clinicFields]) {
      const field = findField(fields, 'supabaseUserId')

      expect(field?.admin?.hidden).toBe(true)
      await expectFieldRead(field, mockUsers.platform(), false)
      await expectFieldRead(field, mockUsers.clinic(), false)
      await expectFieldRead(field, mockUsers.patient(), false)
      await expectFieldRead(field, mockUsers.anonymous(), false)
    }
  })
})
