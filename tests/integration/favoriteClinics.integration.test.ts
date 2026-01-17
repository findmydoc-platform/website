import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { Patient } from '@/payload-types'

describe('FavoriteClinics integration', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('favoriteClinics.integration.test.ts')
  const createdPatientIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for favorite clinic tests')
    cityId = cityDoc.id as number
  })

  afterEach(async () => {
    for (const patientId of createdPatientIds.splice(0)) {
      const { docs: favorites } = await payload.find({
        collection: 'favoriteclinics',
        where: { patient: { equals: patientId } },
        limit: 100,
        overrideAccess: true,
      })
      for (const doc of favorites) {
        await payload.delete({ collection: 'favoriteclinics', id: doc.id, overrideAccess: true })
      }
    }
    await cleanupTestEntities(payload, 'clinics', slugPrefix)

    const { docs } = await payload.find({
      collection: 'patients',
      where: { email: { like: `${slugPrefix}%` } },
      limit: 100,
      overrideAccess: true,
    })
    for (const doc of docs) {
      await payload.delete({ collection: 'patients', id: doc.id, overrideAccess: true })
    }
  })

  it('allows patients to create and delete favorites with unique constraint', async () => {
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-clinic`,
        address: {
          street: 'Favorite Street',
          houseNumber: '1',
          zipCode: 12000,
          country: 'Turkey',
          city: cityId,
        },
        contact: {
          phoneNumber: '+90 555 1111111',
          email: `${slugPrefix}@example.com`,
        },
        supportedLanguages: ['english'],
        status: 'approved',
      },
      overrideAccess: true,
    })

    const patient = (await payload.create({
      collection: 'patients',
      data: {
        email: `${slugPrefix}@patient.com`,
        firstName: 'Favorite',
        lastName: 'Patient',
        supabaseUserId: `sb-${slugPrefix}-patient`,
      },
      overrideAccess: true,
    })) as Patient
    createdPatientIds.push(patient.id)

    const favorite = await payload.create({
      collection: 'favoriteclinics',
      data: {
        patient: patient.id,
        clinic: clinic.id,
      },
      overrideAccess: false,
      user: { ...patient, collection: 'patients' },
    })

    expect(favorite.patient).toBe(patient.id)

    await expect(
      payload.create({
        collection: 'favoriteclinics',
        data: {
          patient: patient.id,
          clinic: clinic.id,
        },
        overrideAccess: false,
        user: { ...patient, collection: 'patients' },
      }),
    ).rejects.toThrow()

    await payload.delete({
      collection: 'favoriteclinics',
      id: favorite.id,
      overrideAccess: false,
      user: { ...patient, collection: 'patients' },
    })

    const result = await payload.find({
      collection: 'favoriteclinics',
      where: { id: { equals: favorite.id } },
      overrideAccess: true,
    })

    expect(result.docs).toHaveLength(0)
  })
})
