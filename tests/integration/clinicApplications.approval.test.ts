import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, ClinicApplication } from '@/payload-types'

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>
type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]
type PayloadFindArgs = Parameters<Payload['find']>[0]

describe('ClinicApplications approval integration (manual provisioning era)', () => {
  let payload: Payload
  const slugPrefix = testSlug('clinicApplications.approval.test.ts')
  const createdApplicationIds: Array<number> = []
  const createdBasicUserIds: Array<number> = []

  const asPayloadUser = (user: BasicUser): PayloadUser => ({ ...user, collection: 'basicUsers' }) as PayloadUser

  const buildApplicationData = (email: string) => ({
    clinicName: 'Integration App Clinic',
    contactFirstName: 'Ivy',
    contactLastName: 'Tester',
    contactEmail: email,
    contactPhone: '+10000000001',
    address: {
      street: 'Main',
      houseNumber: '1',
      zipCode: 34000,
      city: 'Istanbul',
      country: 'Turkey',
    },
    additionalNotes: 'E2E test run',
  })

  const createPlatformUser = async (suffix: string) => {
    const email = `${slugPrefix}-platform-${suffix}@example.com`
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email,
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

  const createClinicUser = async (suffix: string) => {
    const email = `${slugPrefix}-clinic-${suffix}@example.com`
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email,
        userType: 'clinic',
        firstName: 'Clinic',
        lastName: `User-${suffix}`,
        supabaseUserId: `sb-${slugPrefix}-clinic-${suffix}`,
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as BasicUser

    createdBasicUserIds.push(basicUser.id)
    return basicUser
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  }, 60000)

  afterEach(async () => {
    while (createdApplicationIds.length) {
      const id = createdApplicationIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'clinicApplications', id, overrideAccess: true })
      } catch {}
    }

    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      try {
        await payload.delete({
          collection: 'clinicStaff',
          where: { user: { equals: id } },
          overrideAccess: true,
        })
      } catch {}
      try {
        await payload.delete({
          collection: 'platformStaff',
          where: { user: { equals: id } },
          overrideAccess: true,
        })
      } catch {}
      try {
        await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
      } catch {}
    }
  }, 30000)

  it('creates application and allows manual approval status change (no auto-provisioning)', async () => {
    const email = `${slugPrefix}-approval@example.com`
    const app = (await payload.create({
      collection: 'clinicApplications',
      data: {
        ...buildApplicationData(email),
        status: 'submitted',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicApplication

    createdApplicationIds.push(app.id)

    expect(app.id).toBeDefined()
    expect(app.status).toBe('submitted')

    const approved = (await payload.update({
      collection: 'clinicApplications',
      id: app.id,
      data: { status: 'approved' },
      overrideAccess: true,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicApplication

    expect(approved.status).toBe('approved')

    const appAfter = (await payload.findByID({
      collection: 'clinicApplications',
      id: app.id,
      overrideAccess: true,
      depth: 0,
    })) as ClinicApplication

    const links = appAfter.linkedRecords
    expect(links?.basicUser ?? null).toBeFalsy()
    expect(links?.clinic ?? null).toBeFalsy()
    expect(links?.clinicStaff ?? null).toBeFalsy()
  }, 45000)

  it('allows public create with required fields and defaults status to submitted', async () => {
    const email = `${slugPrefix}-public@example.com`
    const app = (await payload.create({
      collection: 'clinicApplications',
      data: buildApplicationData(email),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicApplication

    createdApplicationIds.push(app.id)

    expect(app.status).toBe('submitted')
  })

  it('allows platform users to set reviewNotes', async () => {
    const email = `${slugPrefix}-review@example.com`
    const app = (await payload.create({
      collection: 'clinicApplications',
      data: buildApplicationData(email),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicApplication

    createdApplicationIds.push(app.id)

    const platformUser = await createPlatformUser('review-notes')
    const updated = (await payload.update({
      collection: 'clinicApplications',
      id: app.id,
      data: { reviewNotes: 'Reviewed by platform.' },
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicApplication

    expect(updated.reviewNotes).toBe('Reviewed by platform.')
  })

  it('blocks non-platform users from read/list/update access', async () => {
    const email = `${slugPrefix}-blocked@example.com`
    const app = (await payload.create({
      collection: 'clinicApplications',
      data: buildApplicationData(email),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicApplication

    createdApplicationIds.push(app.id)

    const clinicUser = await createClinicUser('blocked')

    await expect(
      payload.find({
        collection: 'clinicApplications',
        user: asPayloadUser(clinicUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadFindArgs),
    ).rejects.toThrow(/not allowed|perform this action/i)

    await expect(
      payload.update({
        collection: 'clinicApplications',
        id: app.id,
        data: { status: 'approved', reviewNotes: 'Should not persist.' },
        user: asPayloadUser(clinicUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadUpdateArgs),
    ).rejects.toThrow()
  })

  it('rejects missing required fields', async () => {
    await expect(
      payload.create({
        collection: 'clinicApplications',
        data: {},
        overrideAccess: false,
        depth: 0,
      } as PayloadCreateArgs),
    ).rejects.toThrow()
  })

  it('allows linkedRecords updates after status changes', async () => {
    const email = `${slugPrefix}-linked@example.com`
    const app = (await payload.create({
      collection: 'clinicApplications',
      data: buildApplicationData(email),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicApplication

    createdApplicationIds.push(app.id)

    expect(app.linkedRecords?.processedAt ?? null).toBeNull()

    const platformUser = await createPlatformUser('linked-records')
    const processedAt = new Date().toISOString()
    const updated = (await payload.update({
      collection: 'clinicApplications',
      id: app.id,
      data: {
        status: 'approved',
        linkedRecords: { processedAt },
      },
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicApplication

    expect(updated.status).toBe('approved')
    expect(updated.linkedRecords?.processedAt).toBeTruthy()
  })
})
