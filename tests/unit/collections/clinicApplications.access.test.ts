import { describe, test, expect } from 'vitest'
import { ClinicApplications } from '@/collections/ClinicApplications'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq } from '../helpers/testHelpers'

describe('clinicApplications collection access', () => {
  test('anonymous can create (public intake)', () => {
    const canCreate = ClinicApplications.access?.create?.({ req: createMockReq(null) } as any)
    expect(canCreate).toBe(true)
  })

  test('anonymous cannot read', async () => {
    const read = await ClinicApplications.access?.read?.({ req: createMockReq(null) } as any)
    expect(read).toBe(false)
  })

  test('platform can read', async () => {
    const read = await ClinicApplications.access?.read?.({ req: createMockReq(mockUsers.platform()) } as any)
    expect(read).toBe(true)
  })

  test('clinic staff cannot read applications', async () => {
    const read = await ClinicApplications.access?.read?.({ req: createMockReq(mockUsers.clinic()) } as any)
    expect(read).toBe(false)
  })
})
