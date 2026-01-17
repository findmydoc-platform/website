import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'

describe('MedicalSpecialties integration', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('medicalSpecialties.integration.test.ts')
  const createdDoctorSpecialtyIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for specialty tests')
    cityId = cityDoc.id as number
  })

  afterEach(async () => {
    while (createdDoctorSpecialtyIds.length) {
      const id = createdDoctorSpecialtyIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'doctorspecialties', id, overrideAccess: true })
    }

    const { docs } = await payload.find({
      collection: 'medical-specialties',
      where: { name: { like: `${slugPrefix}%` } },
      limit: 100,
      overrideAccess: true,
    })
    for (const doc of docs) {
      await payload.delete({ collection: 'medical-specialties', id: doc.id, overrideAccess: true })
    }
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('creates specialties with parent relationship and doctor links', async () => {
    const parent = await payload.create({
      collection: 'medical-specialties',
      data: {
        name: `${slugPrefix}-parent`,
      },
      overrideAccess: true,
    })

    const child = await payload.create({
      collection: 'medical-specialties',
      data: {
        name: `${slugPrefix}-child`,
        parentSpecialty: parent.id,
      },
      overrideAccess: true,
    })

    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-clinic`,
        address: {
          street: 'Spec Street',
          houseNumber: '1',
          zipCode: 12345,
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
        lastName: 'Specialist',
        clinic: clinic.id,
        qualifications: ['MD'],
        languages: ['english'],
      },
      overrideAccess: true,
    })

    const doctorSpecialty = await payload.create({
      collection: 'doctorspecialties',
      data: {
        doctor: doctor.id,
        medicalSpecialty: child.id,
        specializationLevel: 'expert',
      },
      overrideAccess: true,
    })
    createdDoctorSpecialtyIds.push(doctorSpecialty.id)

    const updatedChild = await payload.findByID({
      collection: 'medical-specialties',
      id: child.id,
      overrideAccess: true,
    })

    expect(updatedChild.parentSpecialty).toBe(parent.id)
    expect(updatedChild.doctorLinks).toBeDefined()
  })
})
