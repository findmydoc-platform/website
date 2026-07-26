import type { FieldAccess } from 'payload'
import { describe, expect, it } from 'vitest'

import { PatientClinicInquiries } from '@/collections/PatientClinicInquiries'
import { createAccessArgs } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import { makePermissionSuite } from './generatePermissionSuite'

type FieldNode = {
  access?: {
    read?: FieldAccess
    update?: FieldAccess
  }
  fields?: FieldNode[]
  name?: string
}

const findField = (fields: FieldNode[], name: string): FieldNode | undefined => {
  for (const field of fields) {
    if (field.name === name) return field
    const nested = field.fields ? findField(field.fields, name) : undefined
    if (nested) return nested
  }
  return undefined
}

makePermissionSuite('patientClinicInquiries', PatientClinicInquiries)

describe('patientClinicInquiries field access', () => {
  const fields = PatientClinicInquiries.fields as FieldNode[]

  it('keeps submitted inquiry data platform-controlled while clinic staff may update status', async () => {
    for (const name of [
      'clinic',
      'fullName',
      'email',
      'phoneNumber',
      'treatmentTimeline',
      'preferredContactWindow',
      'doctor',
      'treatment',
      'message',
      'consent',
      'assignedTo',
    ]) {
      const update = findField(fields, name)?.access?.update

      expect(update).toBeTypeOf('function')
      expect(await update?.(createAccessArgs(mockUsers.platform()))).toBe(true)
      expect(await update?.(createAccessArgs(mockUsers.clinic()))).toBe(false)
    }

    expect(findField(fields, 'status')?.access?.update).toBeUndefined()
  })

  it('keeps consent evidence and platform assignment private from clinic staff', async () => {
    for (const name of ['consent', 'assignedTo']) {
      const read = findField(fields, name)?.access?.read

      expect(read).toBeTypeOf('function')
      expect(await read?.(createAccessArgs(mockUsers.platform()))).toBe(true)
      expect(await read?.(createAccessArgs(mockUsers.clinic()))).toBe(false)
    }
  })
})
