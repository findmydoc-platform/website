import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

describe('BasicUser lifecycle integration', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  beforeEach(async () => {
    // Clean up in case of previous runs
    try {
      await payload.delete({ collection: 'platformStaff', where: {}, overrideAccess: true })
    } catch {}
    try {
      await payload.delete({ collection: 'basicUsers', where: {}, overrideAccess: true })
    } catch {}
  })

  it('creates BasicUser -> creates Supabase user -> creates PlatformStaff profile; then deletes all', async () => {
    // Create BasicUser (platform)
    const basic = await (payload as any).create({
      collection: 'basicUsers',
      data: {
        email: 'platform.staff@example.com',
        userType: 'platform',
        password: 'Strong#12345',
  firstName: 'Platform',
  lastName: 'Staff',
      },
      overrideAccess: true,
      //req: { context: { password: 'Strong#12345' } },
    })

    expect(basic.id).toBeDefined()
    expect(basic.supabaseUserId).toBe('sb-unit-1')
  expect(basic.firstName).toBe('Platform')
  expect(basic.lastName).toBe('Staff')

    // PlatformStaff profile should exist
    const profiles = await (payload as any).find({
      collection: 'platformStaff',
      where: { user: { equals: basic.id } },
      limit: 1,
      overrideAccess: true,
    })
    expect(profiles.docs.length).toBe(1)
  // Profile no longer holds name fields
  expect(profiles.docs[0].firstName).toBeUndefined()
  expect(profiles.docs[0].lastName).toBeUndefined()

    // Now delete the BasicUser and verify cascading cleanup
    await (payload as any).delete({ collection: 'basicUsers', id: basic.id, overrideAccess: true })

    const profilesAfter = await (payload as any).find({
      collection: 'platformStaff',
      where: { user: { equals: basic.id } },
      limit: 1,
      overrideAccess: true,
    })
    expect(profilesAfter.docs.length).toBe(0)
  }, 20000)
})
