import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { testSlug } from '../fixtures/testSlug'
import type { Patient, PlatformStaff } from '@/payload-types'

type PayloadUser = NonNullable<Parameters<Payload['update']>[0]['user']>
type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadFindArgs = Parameters<Payload['find']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]

const asPlatformUser = (user: PlatformStaff): PayloadUser => {
  return { ...user, collection: 'platformStaff' } as unknown as PayloadUser
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
      await payload.delete({ collection: 'patients', where: {}, overrideAccess: true })
    } catch {}
    try {
      await payload.delete({ collection: 'clinicStaff', where: {}, overrideAccess: true })
    } catch {}
  })

  const createPlatformUser = async (suffix: string, role: PlatformStaff['role'] = 'support') => {
    return (await payload.create({
      collection: 'platformStaff',
      data: {
        email: `${slugPrefix}-${suffix}@findmydoc.eu`,
        supabaseUserId: `sb-${slugPrefix}-${suffix}`,
        firstName: 'Platform',
        lastName: `Staff-${suffix}`,
        role,
      },
      context: { trustedPlatformStaffOps: true },
      overrideAccess: true,
    } as PayloadCreateArgs)) as unknown as PlatformStaff
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

  it('allows platform admins to update another role but blocks non-platform users', async () => {
    const adminUser = await createPlatformUser('role-admin', 'admin')
    const profile = await createPlatformUser('role-target')

    const updated = (await payload.update({
      collection: 'platformStaff',
      id: profile.id,
      data: { role: 'content-manager' },
      user: asPlatformUser(adminUser),
      overrideAccess: false,
    } as PayloadUpdateArgs)) as unknown as PlatformStaff

    expect(updated.role).toBe('content-manager')

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
        data: {
          email: `${slugPrefix}-direct-attempt@findmydoc.eu`,
          firstName: 'Direct',
          lastName: 'Attempt',
          role: 'admin',
          supabaseUserId: `sb-${slugPrefix}-direct-attempt`,
        },
        user: asPlatformUser(platformUser),
        overrideAccess: false,
      } as PayloadCreateArgs)
    }).rejects.toThrow()
  })

  it('rejects duplicate Supabase identity assignments', async () => {
    const platformUser = await createPlatformUser('duplicate')

    await expect(async () => {
      await payload.create({
        collection: 'platformStaff',
        data: {
          email: `${slugPrefix}-duplicate-second@findmydoc.eu`,
          firstName: 'Duplicate',
          lastName: 'Identity',
          role: 'support',
          supabaseUserId: platformUser.supabaseUserId,
        },
        context: { trustedPlatformStaffOps: true },
        overrideAccess: true,
      } as PayloadCreateArgs)
    }).rejects.toThrowError(/already assigned|unique|duplicate|violates|constraint/i)
  })

  it('rejects a Supabase identity assigned to another auth collection', async () => {
    const platformUser = await createPlatformUser('cross-collection')

    await expect(
      payload.create({
        collection: 'clinicStaff',
        data: {
          email: `${slugPrefix}-cross-collection@example.com`,
          firstName: 'Clinic',
          lastName: 'Identity',
          status: 'pending',
          supabaseUserId: platformUser.supabaseUserId,
        },
        overrideAccess: true,
      } as PayloadCreateArgs),
    ).rejects.toThrow(/already assigned/i)
  })

  it('allows platform reads but blocks patient reads', async () => {
    const platformUserA = await createPlatformUser('read-a')
    const platformUserB = await createPlatformUser('read-b')
    const patientUser = await createPatientUser('read-blocked')

    const platformRead = await payload.find({
      collection: 'platformStaff',
      user: asPlatformUser(platformUserA),
      overrideAccess: false,
      depth: 0,
    } as PayloadFindArgs)

    const platformStaffIds = platformRead.docs.map((doc) => doc.id)
    expect(platformStaffIds.length).toBeGreaterThanOrEqual(2)

    expect(platformStaffIds).toContain(platformUserB.id)

    await expect(
      payload.find({
        collection: 'platformStaff',
        user: asPatientUser(patientUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadFindArgs),
    ).rejects.toThrow()
  })

  it('blocks delete attempts even for platform users', async () => {
    const platformUser = await createPlatformUser('delete-actor')
    const profile = await createPlatformUser('delete-target')

    await expect(
      payload.delete({
        collection: 'platformStaff',
        id: profile.id,
        user: asPlatformUser(platformUser),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const stillThere = (await payload.findByID({
      collection: 'platformStaff',
      id: profile.id,
      overrideAccess: true,
      depth: 0,
    })) as PlatformStaff

    expect(stillThere.id).toBe(profile.id)
  })
})
