import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, Favoriteclinic, Patient } from '@/payload-types'

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>

describe('FavoriteClinics lifecycle integration', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('favoriteClinics.lifecycle.test.ts')

  const createdFavoriteIds: Array<number> = []
  const createdPatientIds: Array<number> = []
  const createdBasicUserIds: Array<number> = []

  const asPatientUser = (patient: Patient): PayloadUser => {
    return { ...patient, collection: 'patients' as const } as PayloadUser
  }

  const asPlatformUser = (basicUser: BasicUser): PayloadUser => {
    return { ...basicUser, collection: 'basicUsers' as const } as PayloadUser
  }

  const createPatient = async (suffix: string) => {
    const patient = (await payload.create({
      collection: 'patients',
      data: {
        email: `${slugPrefix}-${suffix}@example.com`,
        supabaseUserId: `sb-${slugPrefix}-${suffix}`,
        firstName: 'Patient',
        lastName: suffix,
      },
      overrideAccess: true,
      depth: 0,
    })) as Patient

    createdPatientIds.push(patient.id)
    return patient
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
    })) as BasicUser

    createdBasicUserIds.push(basicUser.id)
    return basicUser
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for favorite clinics tests')
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

    while (createdPatientIds.length) {
      const id = createdPatientIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'patients', id, overrideAccess: true })
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

  it('creates a favorite as a patient', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })
    const patient = await createPatient('create')

    const favorite = (await payload.create({
      collection: 'favoriteclinics',
      data: {
        patient: patient.id,
        clinic: clinic.id,
      },
      user: asPatientUser(patient),
      overrideAccess: false,
      depth: 0,
    })) as Favoriteclinic

    createdFavoriteIds.push(favorite.id)

    expect(favorite.patient).toBe(patient.id)
    expect(favorite.clinic).toBe(clinic.id)
  })

  it('blocks patients from creating favorites for other patients', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })
    const patient = await createPatient('owner')
    const otherPatient = await createPatient('other')

    await expect(async () => {
      await payload.create({
        collection: 'favoriteclinics',
        data: {
          patient: otherPatient.id,
          clinic: clinic.id,
        },
        user: asPatientUser(patient),
        overrideAccess: false,
        depth: 0,
      })
    }).rejects.toThrow()
  })

  it('scopes reads to the patient and allows platform to see all', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-read-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-read-b` })
    const patientA = await createPatient('reader-a')
    const patientB = await createPatient('reader-b')

    const favoriteA = (await payload.create({
      collection: 'favoriteclinics',
      data: { patient: patientA.id, clinic: clinicA.id },
      overrideAccess: true,
      depth: 0,
    })) as Favoriteclinic
    createdFavoriteIds.push(favoriteA.id)

    const favoriteB = (await payload.create({
      collection: 'favoriteclinics',
      data: { patient: patientB.id, clinic: clinicB.id },
      overrideAccess: true,
      depth: 0,
    })) as Favoriteclinic
    createdFavoriteIds.push(favoriteB.id)

    const patientRead = await payload.find({
      collection: 'favoriteclinics',
      user: asPatientUser(patientA),
      overrideAccess: false,
      depth: 0,
    })

    expect(patientRead.docs).toHaveLength(1)
    expect(patientRead.docs[0]?.id).toBe(favoriteA.id)

    const platformUser = await createPlatformUser('reader')
    const platformRead = await payload.find({
      collection: 'favoriteclinics',
      user: asPlatformUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    const platformIds = platformRead.docs.map((doc) => doc.id)
    expect(platformIds).toEqual(expect.arrayContaining([favoriteA.id, favoriteB.id]))
  })

  it('enforces unique patient + clinic favorites', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })
    const patient = await createPatient('unique')

    const favorite = (await payload.create({
      collection: 'favoriteclinics',
      data: { patient: patient.id, clinic: clinic.id },
      user: asPatientUser(patient),
      overrideAccess: false,
      depth: 0,
    })) as Favoriteclinic

    createdFavoriteIds.push(favorite.id)

    await expect(async () => {
      await payload.create({
        collection: 'favoriteclinics',
        data: { patient: patient.id, clinic: clinic.id },
        user: asPatientUser(patient),
        overrideAccess: false,
        depth: 0,
      })
    }).rejects.toThrowError(/unique|duplicate|constraint|favoriteclinics|patient_id|clinic_id/i)
  })

  it('allows patients to delete their favorites', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })
    const patient = await createPatient('delete')

    const favorite = (await payload.create({
      collection: 'favoriteclinics',
      data: { patient: patient.id, clinic: clinic.id },
      overrideAccess: true,
      depth: 0,
    })) as Favoriteclinic

    createdFavoriteIds.push(favorite.id)

    await payload.delete({
      collection: 'favoriteclinics',
      id: favorite.id,
      user: asPatientUser(patient),
      overrideAccess: false,
    })

    createdFavoriteIds.splice(createdFavoriteIds.indexOf(favorite.id), 1)

    await expect(
      payload.findByID({
        collection: 'favoriteclinics',
        id: favorite.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
