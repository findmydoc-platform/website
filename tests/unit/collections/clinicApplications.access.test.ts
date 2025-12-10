import { describe, test, expect } from 'vitest'
import { ClinicApplications } from '@/collections/ClinicApplications'
import { mockUsers } from '../helpers/mockUsers'
import { createAccessArgs, createMockReq } from '../helpers/testHelpers'
import type { AccessArgs } from 'payload'

describe('clinicApplications collection access', () => {
  test('anonymous can create (public intake)', () => {
    const req = createMockReq(null)
    const canCreate = ClinicApplications.access?.create?.(
      createAccessArgs<AccessArgs<typeof ClinicApplications>>(req.user),
    )
    expect(canCreate).toBe(true)
  })

  test('anonymous cannot read', async () => {
    const req = createMockReq(null)
    const read = await ClinicApplications.access?.read?.(
      createAccessArgs<AccessArgs<typeof ClinicApplications>>(req.user),
    )
    expect(read).toBe(false)
  })

  test('platform can read', async () => {
    const req = createMockReq(mockUsers.platform())
    const read = await ClinicApplications.access?.read?.(
      createAccessArgs<AccessArgs<typeof ClinicApplications>>(req.user),
    )
    expect(read).toBe(true)
  })

  test('clinic staff cannot read applications', async () => {
    const req = createMockReq(mockUsers.clinic())
    const read = await ClinicApplications.access?.read?.(
      createAccessArgs<AccessArgs<typeof ClinicApplications>>(req.user),
    )
    expect(read).toBe(false)
  })
})
