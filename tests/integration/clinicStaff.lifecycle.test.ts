import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, ClinicStaff } from '@/payload-types'

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>
type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]

describe('ClinicStaff lifecycle integration', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('clinicStaff.lifecycle.test.ts')

  const createdClinicStaffIds: Array<number> = []
  const createdBasicUserIds: Array<number> = []

  const asPlatformUser = (user: BasicUser): PayloadUser => ({ ...user, collection: 'basicUsers' }) as PayloadUser
  const asClinicUser = (user: BasicUser): PayloadUser => ({ ...user, collection: 'basicUsers' }) as PayloadUser

  const createClinicUser = async (suffix: string) => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}-clinic-${suffix}@example.com`,
        userType: 'clinic',
        firstName: 'Clinic',
        lastName: `User-${suffix}`,
        supabaseUserId: `sb-${slugPrefix}-clinic-${suffix}`,
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as BasicUser

    createdBasicUserIds.push(basicUser.id)

    const clinicStaffResult = await payload.find({
      collection: 'clinicStaff',
      where: { user: { equals: basicUser.id } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })

    const clinicStaff = clinicStaffResult.docs[0] as ClinicStaff | undefined
    if (!clinicStaff) throw new Error('Expected clinic staff profile to be created')

    createdClinicStaffIds.push(clinicStaff.id)

    return { basicUser, clinicStaff }
  }

  const createPlatformUser = async (suffix: string) => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}-platform-${suffix}@example.com`,
        userType: 'platform',
        firstName: 'Platform',
        lastName: `User-${suffix}`,
        supabaseUserId: `sb-${slugPrefix}-platform-${suffix}`,
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as BasicUser

    createdBasicUserIds.push(basicUser.id)
    return basicUser
  }

  const approveClinicStaff = async (clinicStaffId: number, clinicId: number) => {
    return (await payload.update({
      collection: 'clinicStaff',
      id: clinicStaffId,
      data: { clinic: clinicId, status: 'approved' },
      overrideAccess: true,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicStaff
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for clinic staff tests')
    cityId = cityDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdClinicStaffIds.length) {
      const id = createdClinicStaffIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'clinicStaff', id, overrideAccess: true })
      } catch {}
    }

    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
      } catch {}
    }

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('allows platform users to read all clinic staff', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-read-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-read-b` })

    const { clinicStaff: staffA } = await createClinicUser('read-a')
    const { clinicStaff: staffB } = await createClinicUser('read-b')

    await approveClinicStaff(staffA.id, clinicA.id as number)
    await approveClinicStaff(staffB.id, clinicB.id as number)

    const platformUser = await createPlatformUser('read')

    const results = await payload.find({
      collection: 'clinicStaff',
      user: asPlatformUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    const resultIds = results.docs.map((doc) => doc.id)
    expect(resultIds).toEqual(expect.arrayContaining([staffA.id, staffB.id]))
  })

  it('scopes clinic staff reads to their clinic', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-scope-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-scope-b` })

    const { basicUser: clinicUserA, clinicStaff: staffA } = await createClinicUser('scope-a')
    const { clinicStaff: staffB } = await createClinicUser('scope-b')

    await approveClinicStaff(staffA.id, clinicA.id as number)
    await approveClinicStaff(staffB.id, clinicB.id as number)

    const results = await payload.find({
      collection: 'clinicStaff',
      user: asClinicUser(clinicUserA),
      overrideAccess: false,
      depth: 0,
    })

    expect(results.docs).toHaveLength(1)
    expect(results.docs[0]?.id).toBe(staffA.id)
  })

  it('prevents direct API create for clinicStaff', async () => {
    const { basicUser: clinicUser } = await createClinicUser('create-blocked')
    const platformUser = await createPlatformUser('create-blocked')

    await expect(async () => {
      await payload.create({
        collection: 'clinicStaff',
        data: { user: clinicUser.id, status: 'pending' },
        user: asPlatformUser(platformUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadCreateArgs)
    }).rejects.toThrow()
  })

  it('allows platform users to update clinic staff status', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-status` })
    const { clinicStaff } = await createClinicUser('status-update')
    const platformUser = await createPlatformUser('status-update')

    const updated = (await payload.update({
      collection: 'clinicStaff',
      id: clinicStaff.id,
      data: { status: 'approved', clinic: clinic.id },
      user: asPlatformUser(platformUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicStaff

    expect(updated.status).toBe('approved')
    expect(updated.clinic).toBe(clinic.id)
  })

  it('blocks non-platform users from changing status', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-status-blocked` })
    const { basicUser, clinicStaff } = await createClinicUser('status-blocked')

    await approveClinicStaff(clinicStaff.id, clinic.id as number)

    await payload.update({
      collection: 'clinicStaff',
      id: clinicStaff.id,
      data: { status: 'rejected' },
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)

    const refreshed = (await payload.findByID({
      collection: 'clinicStaff',
      id: clinicStaff.id,
      overrideAccess: true,
      depth: 0,
    })) as ClinicStaff

    expect(refreshed.status).toBe('approved')
  })

  it('rejects duplicate clinic staff for the same user', async () => {
    const { clinicStaff } = await createClinicUser('duplicate')

    await expect(async () => {
      await payload.create({
        collection: 'clinicStaff',
        data: { user: clinicStaff.user, status: 'pending' },
        overrideAccess: true,
        depth: 0,
      } as PayloadCreateArgs)
    }).rejects.toThrowError(/user|unique|duplicate|constraint|clinicstaff/i)
  })
})
