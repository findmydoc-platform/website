import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import type { BasicUser, ClinicStaff } from '@/payload-types'

describe('ClinicTreatments access integration', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  const slugPrefix = testSlug('clinicTreatments.access.test.ts')
  const createdBasicUserIds: Array<number | string> = []
  const createdClinicTreatmentIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for clinic treatment access tests')
    cityId = cityDoc.id as number

    const treatmentRes = await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })
    const treatmentDoc = treatmentRes.docs[0]
    if (!treatmentDoc) throw new Error('Expected baseline treatment for clinic treatment access tests')
    treatmentId = treatmentDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
    }

    while (createdClinicTreatmentIds.length) {
      const id = createdClinicTreatmentIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'clinictreatments', id, overrideAccess: true })
    }
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('allows clinic staff to update own clinic treatment but not delete', async () => {
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-clinic`,
        address: {
          street: 'Access Street',
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

    const clinicTreatment = await payload.create({
      collection: 'clinictreatments',
      data: {
        clinic: clinic.id,
        treatment: treatmentId,
        price: 1000,
      },
      overrideAccess: true,
    })
    createdClinicTreatmentIds.push(clinicTreatment.id)

    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}-clinic-user@example.com`,
        userType: 'clinic',
        firstName: 'Clinic',
        lastName: 'Updater',
        supabaseUserId: `sb-${slugPrefix}-clinic`,
      },
      overrideAccess: true,
    })) as BasicUser
    createdBasicUserIds.push(basicUser.id)

    const staffRes = await payload.find({
      collection: 'clinicStaff',
      where: { user: { equals: basicUser.id } },
      limit: 1,
      overrideAccess: true,
    })
    const staffDoc = staffRes.docs[0] as ClinicStaff | undefined
    if (!staffDoc) throw new Error('Expected clinic staff profile')

    await payload.update({
      collection: 'clinicStaff',
      id: staffDoc.id,
      data: { clinic: clinic.id },
      overrideAccess: true,
    })

    const updated = await payload.update({
      collection: 'clinictreatments',
      id: clinicTreatment.id,
      data: { price: 1200 },
      overrideAccess: false,
      user: { ...basicUser, collection: 'basicUsers' },
    })

    expect(updated.price).toBe(1200)

    await expect(
      payload.delete({
        collection: 'clinictreatments',
        id: clinicTreatment.id,
        overrideAccess: false,
        user: { ...basicUser, collection: 'basicUsers' },
      }),
    ).rejects.toThrow()
  })
})
