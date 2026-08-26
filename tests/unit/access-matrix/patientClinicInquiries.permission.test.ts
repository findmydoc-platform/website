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

  it('keeps inquiry domain fields unavailable through generic collection access', async () => {
    for (const name of [
      'patient',
      'clinic',
      'phoneNumber',
      'doctor',
      'treatment',
      'message',
      'consent',
      'status',
      'handlingStatus',
      'lifecycle',
      'revision',
      'activitySequence',
      'externalSequence',
      'clinicUnreadFloor',
      'creationActorKey',
      'creationIdempotencyKey',
      'creationRequestHash',
    ]) {
      const field = findField(fields, name)

      expect(field?.access?.read).toBeTypeOf('function')
      expect(field?.access?.update).toBeTypeOf('function')
      expect(await field?.access?.read?.(createAccessArgs(mockUsers.platform()))).toBe(false)
      expect(await field?.access?.read?.(createAccessArgs(mockUsers.clinic()))).toBe(false)
      expect(await field?.access?.update?.(createAccessArgs(mockUsers.platform()))).toBe(false)
      expect(await field?.access?.update?.(createAccessArgs(mockUsers.clinic()))).toBe(false)
    }
  })

  it('keeps the optional platform assignment private from clinic staff', async () => {
    const read = findField(fields, 'assignedTo')?.access?.read

    expect(read).toBeTypeOf('function')
    expect(await read?.(createAccessArgs(mockUsers.platform()))).toBe(true)
    expect(await read?.(createAccessArgs(mockUsers.clinic()))).toBe(false)
  })
})
