import { describe, expect, it, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../../fixtures/ensureBaseline'
import { createClinicFixture } from '../../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../../fixtures/cleanupTestEntities'
import {
  cleanupTrackedUsers,
  createPatientTestUser,
  createPlatformTestUser,
  asPayloadBasicUser,
  asPayloadPatientUser,
} from '../../fixtures/testUsers'
import { testSlug } from '../../fixtures/testSlug'

describe('FavoriteClinics access', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('favoriteClinics-access.test.ts')
  const createdFavoriteIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const createdBasicUserIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for favorite clinic tests')
    cityId = cityDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdFavoriteIds.length) {
      const id = createdFavoriteIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'favoriteclinics', id, overrideAccess: true })
      } catch {}
    }

    await cleanupTrackedUsers(payload, { basicUserIds: createdBasicUserIds, patientIds: createdPatientIds })
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
  })

  it('lets platform users manage any patient favorite', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-b` })

    const patient = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient`,
      createdPatientIds,
    })

    const favorite = await payload.create({
      collection: 'favoriteclinics',
      data: { patient: patient.id, clinic: clinicA.id },
      overrideAccess: true,
    })

    createdFavoriteIds.push(favorite.id)

    const platformUser = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform`,
      createdBasicUserIds,
    })

    const updated = await payload.update({
      collection: 'favoriteclinics',
      id: favorite.id,
      data: { clinic: clinicB.id },
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
    })

    const updatedClinicId = typeof updated.clinic === 'object' ? updated.clinic?.id : updated.clinic
    expect(updatedClinicId).toBe(clinicB.id)

    await payload.delete({
      collection: 'favoriteclinics',
      id: updated.id,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
    })

    createdFavoriteIds.pop()
  })

  it('scopes patients to their own favorites and blocks cross patient mutations', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-scope-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-scope-b` })

    const patientA = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient-a`,
      createdPatientIds,
    })
    const patientB = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient-b`,
      createdPatientIds,
    })

    const favoriteA = await payload.create({
      collection: 'favoriteclinics',
      data: { patient: patientA.id, clinic: clinicA.id },
      overrideAccess: true,
    })
    const favoriteB = await payload.create({
      collection: 'favoriteclinics',
      data: { patient: patientB.id, clinic: clinicB.id },
      overrideAccess: true,
    })

    createdFavoriteIds.push(favoriteA.id, favoriteB.id)

    const patientRead = await payload.find({
      collection: 'favoriteclinics',
      user: asPayloadPatientUser(patientA),
      overrideAccess: false,
    })

    expect(patientRead.docs).toHaveLength(1)
    expect(patientRead.docs[0]?.id).toBe(favoriteA.id)

    const platformUser = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform-reader`,
      createdBasicUserIds,
    })

    const platformRead = await payload.find({
      collection: 'favoriteclinics',
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
    })

    expect(platformRead.docs.length).toBeGreaterThanOrEqual(2)

    await expect(
      payload.update({
        collection: 'favoriteclinics',
        id: favoriteB.id,
        data: { clinic: clinicA.id },
        user: asPayloadPatientUser(patientA),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.delete({
        collection: 'favoriteclinics',
        id: favoriteB.id,
        user: asPayloadPatientUser(patientA),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})
