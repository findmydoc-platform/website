import { ClinicProfileDrafts } from '@/collections/ClinicProfileDrafts'
import { describe, expect, it } from 'vitest'
import { createMockReq } from '../helpers/testHelpers'
import { makePermissionSuite } from './generatePermissionSuite'

makePermissionSuite('clinicProfileDrafts', ClinicProfileDrafts)

describe('clinic profile draft command boundary', () => {
  it.each(['admin', 'support', 'content-manager'])('denies generic access to platform %s', async (role) => {
    const req = createMockReq({ collection: 'platformStaff', id: 1, role })
    for (const operation of ['read', 'create', 'update', 'delete', 'admin'] as const) {
      expect(await ClinicProfileDrafts.access?.[operation]?.({ req })).toBe(false)
    }
  })
})
