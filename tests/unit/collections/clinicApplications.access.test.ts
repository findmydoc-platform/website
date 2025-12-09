import { describe, test, expect } from 'vitest'
import { ClinicApplications } from '@/collections/ClinicApplications'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq } from '../helpers/testHelpers'

describe('clinicApplications collection access', () => {
  type CreateArgs = Parameters<NonNullable<typeof ClinicApplications.access>['create']>[0]
  type ReadArgs = Parameters<NonNullable<typeof ClinicApplications.access>['read']>[0]

  test('anonymous can create (public intake)', () => {
    const req = createMockReq(null)
    const canCreate = ClinicApplications.access?.create?.({ req } satisfies CreateArgs)
    expect(canCreate).toBe(true)
  })

  test('anonymous cannot read', async () => {
    const req = createMockReq(null)
    const read = await ClinicApplications.access?.read?.({ req } satisfies ReadArgs)
    expect(read).toBe(false)
  })

  test('platform can read', async () => {
    const req = createMockReq(mockUsers.platform())
    const read = await ClinicApplications.access?.read?.({ req } satisfies ReadArgs)
    expect(read).toBe(true)
  })

  test('clinic staff cannot read applications', async () => {
    const req = createMockReq(mockUsers.clinic())
    const read = await ClinicApplications.access?.read?.({ req } satisfies ReadArgs)
    expect(read).toBe(false)
  })
})
