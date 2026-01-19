/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import type { BasicUser, ClinicStaff, Patient } from '@/payload-types'

describe('BasicUser lifecycle integration', () => {
  let payload: Payload

  type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>
  type PayloadCreateArgs = Parameters<Payload['create']>[0]
  type PayloadUpdateArgs = Parameters<Payload['update']>[0]

  const asPlatformUser = (user: BasicUser): PayloadUser => ({ ...user, collection: 'basicUsers' }) as PayloadUser
  const asPatientUser = (user: Patient): PayloadUser => ({ ...user, collection: 'patients' }) as PayloadUser

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  beforeEach(async () => {
    // Clean up in case of previous runs
    try {
      await payload.delete({ collection: 'platformStaff', where: {}, overrideAccess: true })
    } catch {}
    try {
      await payload.delete({ collection: 'clinicStaff', where: {}, overrideAccess: true })
    } catch {}
    try {
      await payload.delete({ collection: 'basicUsers', where: {}, overrideAccess: true })
    } catch {}
    try {
      await payload.delete({ collection: 'patients', where: {}, overrideAccess: true })
    } catch {}
  })

  it('creates BasicUser -> creates Supabase user -> creates PlatformStaff profile; then deletes all', async () => {
    // Create BasicUser (platform)
    const basic = await (payload as any).create({
      collection: 'basicUsers',
      data: {
        email: 'platform.staff@example.com',
        userType: 'platform',
        firstName: 'Platform',
        lastName: 'Staff',
      },
      overrideAccess: true,
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

  it('creates a clinic BasicUser and creates a ClinicStaff profile', async () => {
    const clinicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: 'clinic.staff@example.com',
        userType: 'clinic',
        firstName: 'Clinic',
        lastName: 'Staff',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as BasicUser

    expect(clinicUser.id).toBeDefined()
    expect(clinicUser.supabaseUserId).toBe('sb-unit-1')

    const profiles = await payload.find({
      collection: 'clinicStaff',
      where: { user: { equals: clinicUser.id } },
      limit: 1,
      overrideAccess: true,
    })

    expect(profiles.docs).toHaveLength(1)
    const clinicProfile = profiles.docs[0] as ClinicStaff
    const clinicProfileUser =
      typeof clinicProfile.user === 'object' && clinicProfile.user !== null
        ? ((clinicProfile.user as { id?: number; value?: number }).id ??
          (clinicProfile.user as { id?: number; value?: number }).value)
        : clinicProfile.user
    expect(clinicProfileUser).toBe(clinicUser.id)
    expect(clinicProfile.status).toBe('pending')
  }, 20000)

  it('blocks non-platform users from creating BasicUsers', async () => {
    const patient = (await payload.create({
      collection: 'patients',
      data: {
        email: 'basicuser.blocked.patient@example.com',
        firstName: 'Patient',
        lastName: 'Creator',
        supabaseUserId: 'sb-basicuser-patient-1',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as Patient

    await expect(async () => {
      await payload.create({
        collection: 'basicUsers',
        data: {
          email: 'basicuser.blocked@example.com',
          userType: 'platform',
          firstName: 'Blocked',
          lastName: 'User',
          supabaseUserId: 'sb-basicuser-blocked',
        },
        user: asPatientUser(patient),
        overrideAccess: false,
        depth: 0,
      } as PayloadCreateArgs)
    }).rejects.toThrow()
  }, 20000)

  it('rejects duplicate email addresses', async () => {
    await payload.create({
      collection: 'basicUsers',
      data: {
        email: 'basicuser.duplicate@example.com',
        userType: 'platform',
        firstName: 'Duplicate',
        lastName: 'User',
        supabaseUserId: 'sb-basicuser-duplicate-1',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)

    await expect(async () => {
      await payload.create({
        collection: 'basicUsers',
        data: {
          email: 'basicuser.duplicate@example.com',
          userType: 'clinic',
          firstName: 'Duplicate',
          lastName: 'User',
          supabaseUserId: 'sb-basicuser-duplicate-2',
        },
        overrideAccess: true,
        depth: 0,
      } as PayloadCreateArgs)
    }).rejects.toThrowError(/email|unique|duplicate|constraint/i)
  }, 20000)

  it('allows platform users to update BasicUser profile fields', async () => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: 'basicuser.update@example.com',
        userType: 'platform',
        firstName: 'Update',
        lastName: 'Target',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as BasicUser

    const updated = (await payload.update({
      collection: 'basicUsers',
      id: basicUser.id,
      data: {
        firstName: 'Updated',
        lastName: 'Name',
      },
      user: asPlatformUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as BasicUser

    expect(updated.firstName).toBe('Updated')
    expect(updated.lastName).toBe('Name')
  }, 20000)
})
