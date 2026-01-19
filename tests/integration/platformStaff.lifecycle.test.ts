import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, Patient, PlatformStaff } from '@/payload-types'

type PayloadUser = NonNullable<Parameters<Payload['update']>[0]['user']>
type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadFindArgs = Parameters<Payload['find']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]

const asPayloadUser = (user: BasicUser): PayloadUser => {
  return { ...user, collection: 'basicUsers' } as unknown as PayloadUser
}

const asPatientUser = (user: Patient): PayloadUser => {
  return { ...user, collection: 'patients' } as unknown as PayloadUser
}

describe('PlatformStaff integration - access and constraints', () => {
  let payload: Payload
  const slugPrefix = testSlug('platformStaff.lifecycle.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  beforeEach(async () => {
    try {
      await payload.delete({ collection: 'platformStaff', where: {}, overrideAccess: true })
    } catch {}
    try {
      await payload.delete({ collection: 'basicUsers', where: {}, overrideAccess: true })
    } catch {}
  })

  const createPlatformUser = async (suffix: string) => {
    return (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}-${suffix}@example.com`,
        userType: 'platform',
        firstName: 'Platform',
        lastName: `Staff-${suffix}`,
      },
      overrideAccess: true,
    } as PayloadCreateArgs)) as unknown as BasicUser
  }

  const createPatientUser = async (suffix: string) => {
    return (await payload.create({
      collection: 'patients',
      data: {
        email: `${slugPrefix}-patient-${suffix}@example.com`,
        firstName: 'Patient',
        lastName: `Staff-${suffix}`,
      },
      overrideAccess: true,
    } as PayloadCreateArgs)) as unknown as Patient
  }

  it('allows platform users to update role but blocks non-platform users', async () => {
    const platformUser = await createPlatformUser('role-update')

    const profileResult = await payload.find({
      collection: 'platformStaff',
      where: { user: { equals: platformUser.id } },
      limit: 1,
      overrideAccess: true,
    } as PayloadFindArgs)

    expect(profileResult.docs).toHaveLength(1)
    const profile = profileResult.docs[0] as PlatformStaff

    const updated = (await payload.update({
      collection: 'platformStaff',
      id: profile.id,
      data: { role: 'support' },
      user: asPayloadUser(platformUser),
      overrideAccess: false,
    } as PayloadUpdateArgs)) as unknown as PlatformStaff

    expect(updated.role).toBe('support')

    const patientUser = await createPatientUser('role-blocked')

    await expect(async () => {
      await payload.update({
        collection: 'platformStaff',
        id: profile.id,
        data: { role: 'content-manager' },
        user: asPatientUser(patientUser),
        overrideAccess: false,
      } as PayloadUpdateArgs)
    }).rejects.toThrow()
  })

  it('prevents direct API create for platformStaff', async () => {
    const platformUser = await createPlatformUser('direct-create')

    await expect(async () => {
      await payload.create({
        collection: 'platformStaff',
        data: { user: platformUser.id, role: 'admin' },
        user: asPayloadUser(platformUser),
        overrideAccess: false,
      } as PayloadCreateArgs)
    }).rejects.toThrow()
  })

  it('rejects duplicate user assignments (unique constraint)', async () => {
    const platformUser = await createPlatformUser('duplicate')

    const profileResult = await payload.find({
      collection: 'platformStaff',
      where: { user: { equals: platformUser.id } },
      limit: 1,
      overrideAccess: true,
    } as PayloadFindArgs)

    expect(profileResult.docs).toHaveLength(1)

    await expect(async () => {
      await payload.create({
        collection: 'platformStaff',
        data: { user: platformUser.id, role: 'support' },
        overrideAccess: true,
      } as PayloadCreateArgs)
    }).rejects.toThrowError(/user|unique|duplicate|violates|constraint|platformstaff/i)
  })
})
