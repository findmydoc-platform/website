import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

describe('Direct staff principal lifecycle integration', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  beforeEach(async () => {
    await payload.delete({ collection: 'platformStaff', where: {}, overrideAccess: true })
    await payload.delete({ collection: 'clinicStaff', where: {}, overrideAccess: true })
    await payload.delete({ collection: 'patients', where: {}, overrideAccess: true })
  })

  it('creates a direct platform principal only through the trusted operations context', async () => {
    await expect(
      payload.create({
        collection: 'platformStaff',
        data: {
          email: 'platform.staff@findmydoc.eu',
          firstName: 'Platform',
          lastName: 'Staff',
          role: 'admin',
          supabaseUserId: 'sb-platform-staff',
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/trusted operations/i)

    const platformStaff = await payload.create({
      collection: 'platformStaff',
      data: {
        email: 'platform.staff@findmydoc.eu',
        firstName: 'Platform',
        lastName: 'Staff',
        role: 'admin',
        supabaseUserId: 'sb-platform-staff',
      },
      context: { trustedPlatformStaffOps: true },
      overrideAccess: true,
    })

    expect(platformStaff.collection).toBe('platformStaff')
    expect(platformStaff.role).toBe('admin')
    expect(platformStaff.supabaseUserId).toBe('sb-platform-staff')
  })

  it('rejects a Supabase identity in a second auth collection', async () => {
    await payload.create({
      collection: 'platformStaff',
      data: {
        email: 'platform.identity@findmydoc.eu',
        firstName: 'Platform',
        lastName: 'Identity',
        role: 'support',
        supabaseUserId: 'sb-shared-principal',
      },
      context: { trustedPlatformStaffOps: true },
      overrideAccess: true,
    })

    await expect(
      payload.create({
        collection: 'clinicStaff',
        data: {
          email: 'clinic.identity@example.com',
          firstName: 'Clinic',
          lastName: 'Identity',
          status: 'pending',
          supabaseUserId: 'sb-shared-principal',
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/already assigned/i)
  })

  it('keeps BasicUsers unavailable to runtime writes', async () => {
    await expect(
      payload.create({
        collection: 'basicUsers',
        data: {
          email: 'legacy@findmydoc.eu',
          firstName: 'Legacy',
          lastName: 'Principal',
          userType: 'platform',
        },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
