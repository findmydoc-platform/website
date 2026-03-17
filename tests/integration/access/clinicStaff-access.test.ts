import { describe, expect, it, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../../fixtures/ensureBaseline'
import { createClinicFixture } from '../../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../../fixtures/cleanupTestEntities'
import { cleanupTrackedUsers, createPlatformTestUser, asPayloadBasicUser } from '../../fixtures/testUsers'
import { asBasicUserPayload, createClinicUserWithStaff, approveClinicStaff } from '../../fixtures/clinicUserFixtures'
import { testSlug } from '../../fixtures/testSlug'

describe('ClinicStaff access', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('clinicStaff-access.test.ts')
  const createdBasicUserIds: Array<number | string> = []
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

    await cleanupTrackedUsers(payload, { basicUserIds: createdBasicUserIds })
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
  })

  it('scopes clinic staff reads to their clinic', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-read-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-read-b` })

    const { basicUser: clinicUserA, clinicStaff: staffA } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'read-a',
      createdBasicUserIds,
      createdClinicStaffIds,
    })
    const { clinicStaff: staffB } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'read-b',
      createdBasicUserIds,
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, staffA.id, clinicA.id as number)
    await approveClinicStaff(payload, staffB.id, clinicB.id as number)

    const results = await payload.find({
      collection: 'clinicStaff',
      user: asBasicUserPayload(clinicUserA),
      overrideAccess: false,
      depth: 0,
    })

    expect(results.docs).toHaveLength(1)
    expect(results.docs[0]?.id).toBe(staffA.id)
    expect(results.docs[0]?.clinic).toBe(clinicA.id)
  })

  it('allows clinic staff to update their own profile but not others', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-update-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-update-b` })

    const { basicUser: clinicUserA, clinicStaff: staffA } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'update-a',
      createdBasicUserIds,
      createdClinicStaffIds,
    })
    const { clinicStaff: staffB } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'update-b',
      createdBasicUserIds,
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, staffA.id, clinicA.id as number)
    await approveClinicStaff(payload, staffB.id, clinicB.id as number)

    const updated = await payload.update({
      collection: 'clinicStaff',
      id: staffA.id,
      data: { clinic: clinicA.id },
      user: asBasicUserPayload(clinicUserA),
      overrideAccess: false,
      depth: 0,
    })

    expect(updated.id).toBe(staffA.id)

    await expect(
      payload.update({
        collection: 'clinicStaff',
        id: staffB.id,
        data: { clinic: clinicB.id },
        user: asBasicUserPayload(clinicUserA),
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow()

    const platformUser = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform`,
      createdBasicUserIds,
    })

    await payload.update({
      collection: 'clinicStaff',
      id: staffB.id,
      data: { clinic: clinicA.id },
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    await expect(
      payload.delete({
        collection: 'clinicStaff',
        id: staffA.id,
        user: asPayloadBasicUser(platformUser),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
