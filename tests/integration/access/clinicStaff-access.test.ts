import { describe, expect, it, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../../fixtures/ensureBaseline'
import { createClinicFixture } from '../../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../../fixtures/cleanupTestEntities'
import { cleanupTrackedUsers, createPlatformTestUser, asPayloadStaffUser } from '../../fixtures/testUsers'
import { asStaffPayloadUser, createClinicStaffFixture, approveClinicStaff } from '../../fixtures/clinicUserFixtures'
import { testSlug } from '../../fixtures/testSlug'

describe('ClinicStaff access', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('clinicStaff-access.test.ts')
  const createdStaffIds: Array<number | string> = []
  const createdClinicStaffIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for clinic staff access tests')
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

    await cleanupTrackedUsers(payload, { staffIds: createdStaffIds })
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
  })

  it('scopes clinic staff reads to their clinic', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-read-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-read-b` })

    const { staffUser: clinicUserA, clinicStaff: staffA } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'read-a',
      createdClinicStaffIds,
    })
    const { clinicStaff: staffB } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'read-b',
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, staffA.id, clinicA.id as number)
    await approveClinicStaff(payload, staffB.id, clinicB.id as number)

    const results = await payload.find({
      collection: 'clinicStaff',
      user: asStaffPayloadUser(clinicUserA),
      overrideAccess: false,
      depth: 0,
    })

    expect(results.docs).toHaveLength(1)
    expect(results.docs[0]?.id).toBe(staffA.id)
    expect(results.docs[0]?.clinic).toBe(clinicA.id)
    expect(results.docs[0]).toMatchObject({
      email: staffA.email,
      firstName: staffA.firstName,
      lastName: staffA.lastName,
    })
    expect(results.docs[0]).not.toHaveProperty('supabaseUserId')
  })

  it('allows platform staff to review safe clinic identity fields', async () => {
    const { clinicStaff } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'platform-review',
      createdClinicStaffIds,
    })
    const platformUser = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform-review`,
      createdStaffIds,
    })

    const result = await payload.findByID({
      collection: 'clinicStaff',
      id: clinicStaff.id,
      user: asPayloadStaffUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    expect(result).toMatchObject({
      email: clinicStaff.email,
      firstName: clinicStaff.firstName,
      lastName: clinicStaff.lastName,
    })
    expect(result).not.toHaveProperty('supabaseUserId')
  })

  it('keeps authorization fields immutable for clinic staff', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-update-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-update-b` })

    const { staffUser: clinicUserA, clinicStaff: staffA } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'update-a',
      createdClinicStaffIds,
    })
    const { staffUser: _clinicUserB, clinicStaff: staffB } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'update-b',
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, staffA.id, clinicA.id as number)
    await approveClinicStaff(payload, staffB.id, clinicB.id as number)

    const updated = await payload.update({
      collection: 'clinicStaff',
      id: staffA.id,
      data: { clinic: clinicB.id },
      user: asStaffPayloadUser(clinicUserA),
      overrideAccess: false,
      depth: 0,
    })

    expect(updated.id).toBe(staffA.id)
    expect(updated.clinic).toBe(clinicA.id)

    const persisted = await payload.findByID({
      collection: 'clinicStaff',
      id: staffA.id,
      overrideAccess: true,
      depth: 0,
    })

    expect(persisted.clinic).toBe(clinicA.id)

    await expect(
      payload.update({
        collection: 'clinicStaff',
        id: staffB.id,
        data: { clinic: clinicB.id },
        user: asStaffPayloadUser(clinicUserA),
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow()

    const platformUser = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform`,
      createdStaffIds,
    })

    const platformUpdated = await payload.update({
      collection: 'clinicStaff',
      id: staffB.id,
      data: { clinic: clinicA.id },
      user: asPayloadStaffUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    expect(platformUpdated.clinic).toBe(clinicA.id)

    await expect(
      payload.delete({
        collection: 'clinicStaff',
        id: staffA.id,
        user: asPayloadStaffUser(platformUser),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
