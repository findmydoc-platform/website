import { describe, expect, it, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../../fixtures/cleanupTestEntities'
import {
  cleanupTrackedUsers,
  createPatientTestUser,
  createPlatformTestUser,
  asPayloadStaffUser,
  asPayloadPatientUser,
} from '../../fixtures/testUsers'
import { createClinicStaffFixture, approveClinicStaff } from '../../fixtures/clinicUserFixtures'
import { testSlug } from '../../fixtures/testSlug'
import type { Clinic } from '@/payload-types'

const buildClinicData = (
  suffix: string,
  cityId: number,
  status: 'approved' | 'draft' | 'pending',
): Pick<
  Clinic,
  'name' | 'slug' | 'address' | 'contact' | 'internalPrimaryContact' | 'supportedLanguages' | 'status'
> => ({
  name: `${suffix} clinic`,
  slug: suffix,
  address: {
    street: 'Access Street',
    houseNumber: '1',
    zipCode: 12345,
    country: 'Testland',
    city: cityId,
  },
  contact: {
    phoneNumber: '+1000000000',
    email: `${suffix}@example.com`,
    website: 'https://example.com',
  },
  internalPrimaryContact: {
    firstName: 'Access',
    lastName: 'Coordinator',
    email: `${suffix}-primary@example.com`,
    role: 'Clinic Management',
  },
  supportedLanguages: ['english'] as Clinic['supportedLanguages'],
  status,
})

describe('Clinics access', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('clinics-access.test.ts')
  const createdStaffIds: Array<number | string> = []
  const createdClinicStaffIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for clinic access tests')
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

    await cleanupTrackedUsers(payload, { staffIds: createdStaffIds, patientIds: createdPatientIds })
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
  })

  it('limits non-platform reads to approved clinics', async () => {
    const approvedSlug = `${slugPrefix}-approved`
    const draftSlug = `${slugPrefix}-draft`

    const approved = await payload.create({
      collection: 'clinics',
      data: buildClinicData(approvedSlug, cityId, 'approved'),
      draft: false,
      overrideAccess: true,
      depth: 0,
    })
    const draft = await payload.create({
      collection: 'clinics',
      data: buildClinicData(draftSlug, cityId, 'draft'),
      draft: false,
      overrideAccess: true,
      depth: 0,
    })

    const patient = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient`,
      createdPatientIds,
    })

    const patientRead = await payload.find({
      collection: 'clinics',
      where: { slug: { in: [approved.slug, draft.slug] } },
      user: asPayloadPatientUser(patient),
      overrideAccess: false,
    })

    expect(patientRead.docs).toHaveLength(1)
    expect(patientRead.docs[0]?.status).toBe('approved')

    const { staffUser: clinicUser, clinicStaff } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'clinic-read',
      createdClinicStaffIds,
    })
    await approveClinicStaff(payload, clinicStaff.id, approved.id as number)

    const clinicRead = await payload.find({
      collection: 'clinics',
      where: { slug: { in: [approved.slug, draft.slug] } },
      user: asPayloadStaffUser(clinicUser),
      overrideAccess: false,
    })

    expect(clinicRead.docs).toHaveLength(1)
    expect(clinicRead.docs[0]?.status).toBe('approved')

    const platformUser = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform`,
      createdStaffIds,
    })

    const platformRead = await payload.find({
      collection: 'clinics',
      where: { slug: { in: [approved.slug, draft.slug] } },
      user: asPayloadStaffUser(platformUser),
      overrideAccess: false,
    })

    expect(platformRead.docs.length).toBeGreaterThanOrEqual(2)
  })

  it('allows clinic staff to update their clinic only while platform can manage all', async () => {
    const clinicA = await payload.create({
      collection: 'clinics',
      data: buildClinicData(`${slugPrefix}-own`, cityId, 'approved'),
      draft: false,
      overrideAccess: true,
      depth: 0,
    })
    const clinicB = await payload.create({
      collection: 'clinics',
      data: buildClinicData(`${slugPrefix}-other`, cityId, 'approved'),
      draft: false,
      overrideAccess: true,
      depth: 0,
    })

    const { staffUser: clinicUser, clinicStaff } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'staff',
      createdClinicStaffIds,
    })
    await approveClinicStaff(payload, clinicStaff.id, clinicA.id as number)
    const clinicPayloadUser = asPayloadStaffUser(clinicUser)

    const updated = await payload.update({
      collection: 'clinics',
      id: clinicA.id,
      data: { name: `${slugPrefix}-own-updated` },
      user: clinicPayloadUser,
      overrideAccess: false,
      depth: 0,
    })

    expect(updated.name).toContain('own-updated')

    await expect(
      payload.update({
        collection: 'clinics',
        id: clinicB.id,
        data: { name: `${slugPrefix}-other-attempt` },
        user: clinicPayloadUser,
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow()

    await expect(
      payload.create({
        collection: 'clinics',
        data: buildClinicData(`${slugPrefix}-blocked-create`, cityId, 'draft'),
        draft: false,
        user: clinicPayloadUser,
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow()

    const platformUser = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform-manager`,
      createdStaffIds,
    })

    const platformCreated = await payload.create({
      collection: 'clinics',
      data: buildClinicData(`${slugPrefix}-platform-create`, cityId, 'draft'),
      draft: false,
      user: asPayloadStaffUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    expect(platformCreated.id).toBeDefined()

    const platformUpdated = await payload.update({
      collection: 'clinics',
      id: clinicB.id,
      data: { name: `${slugPrefix}-other-platform` },
      user: asPayloadStaffUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    expect(platformUpdated.name).toContain('platform')

    await payload.delete({
      collection: 'clinics',
      id: clinicB.id,
      user: asPayloadStaffUser(platformUser),
      overrideAccess: false,
    })

    await expect(
      payload.delete({
        collection: 'clinics',
        id: clinicA.id,
        user: clinicPayloadUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
