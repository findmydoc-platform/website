import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'

describe('DoctorTreatments integration', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  const slugPrefix = testSlug('doctorTreatments.integration.test.ts')
  const createdDoctorTreatmentIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for doctor treatment tests')
    cityId = cityDoc.id as number

    const treatmentRes = await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })
    const treatmentDoc = treatmentRes.docs[0]
    if (!treatmentDoc) throw new Error('Expected baseline treatment for doctor treatment tests')
    treatmentId = treatmentDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdDoctorTreatmentIds.length) {
      const id = createdDoctorTreatmentIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'doctortreatments', id, overrideAccess: true })
    }
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('creates and updates doctor treatments, enforcing uniqueness', async () => {
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-clinic`,
        address: {
          street: 'Doctor Street',
          houseNumber: '2',
          zipCode: 11111,
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

    const doctor = await payload.create({
      collection: 'doctors',
      data: {
        firstName: `${slugPrefix}-Doc`,
        lastName: 'Treatment',
        clinic: clinic.id,
        qualifications: ['MD'],
        languages: ['english'],
      },
      overrideAccess: true,
    })

    const link = await payload.create({
      collection: 'doctortreatments',
      data: {
        doctor: doctor.id,
        treatment: treatmentId,
        specializationLevel: 'expert',
      },
      overrideAccess: true,
    })
    createdDoctorTreatmentIds.push(link.id)

    const updated = await payload.update({
      collection: 'doctortreatments',
      id: link.id,
      data: { specializationLevel: 'advanced' },
      overrideAccess: true,
    })

    expect(updated.specializationLevel).toBe('advanced')

    await expect(
      payload.create({
        collection: 'doctortreatments',
        data: {
          doctor: doctor.id,
          treatment: treatmentId,
          specializationLevel: 'expert',
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
