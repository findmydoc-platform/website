import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import type { BasicUser, PlatformStaff } from '@/payload-types'

describe('PlatformStaff integration', () => {
  let payload: Payload
  const createdBasicUserIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
    }
  })

  it('blocks direct create requests', async () => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: 'platform.staff.create@example.com',
        userType: 'platform',
        firstName: 'Platform',
        lastName: 'User',
        supabaseUserId: 'sb-platform-staff-create',
      },
      overrideAccess: true,
    })) as BasicUser
    createdBasicUserIds.push(basicUser.id)

    await expect(
      payload.create({
        collection: 'platformStaff',
        data: {
          user: basicUser.id,
          role: 'support',
        },
        overrideAccess: false,
        user: { ...basicUser, collection: 'basicUsers' },
      }),
    ).rejects.toThrow()
  })

  it('allows platform user to update role', async () => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: 'platform.staff.update@example.com',
        userType: 'platform',
        firstName: 'Role',
        lastName: 'Updater',
        supabaseUserId: 'sb-platform-staff-update',
      },
      overrideAccess: true,
    })) as BasicUser
    createdBasicUserIds.push(basicUser.id)

    const staffRes = await payload.find({
      collection: 'platformStaff',
      where: { user: { equals: basicUser.id } },
      limit: 1,
      overrideAccess: true,
    })
    const staffDoc = staffRes.docs[0] as PlatformStaff | undefined
    if (!staffDoc) throw new Error('Expected platform staff profile')

    const updated = await payload.update({
      collection: 'platformStaff',
      id: staffDoc.id,
      data: { role: 'content-manager' },
      overrideAccess: false,
      user: { ...basicUser, collection: 'basicUsers' },
    })

    expect(updated.role).toBe('content-manager')
  })
})
