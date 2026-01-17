import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'

describe('DoctorSpecialties integration', () => {
  let payload: Payload
  let cityId: number
  let specialtyId: number
  const slugPrefix = testSlug('doctorSpecialties.integration.test.ts')
  const createdDoctorSpecialtyIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for doctor specialty tests')
    cityId = cityDoc.id as number

    const specialtyRes = await payload.find({
      collection: 'medical-specialties',
      limit: 1,
      overrideAccess: true,
    })
    const specialtyDoc = specialtyRes.docs[0]
    if (!specialtyDoc) throw new Error('Expected baseline specialty for doctor specialty tests')
    specialtyId = specialtyDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdDoctorSpecialtyIds.length) {
      const id = createdDoctorSpecialtyIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'doctorspecialties', id, overrideAccess: true })
    }
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('creates doctor specialties with certifications and enforces uniqueness', async () => {
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-clinic`,
        address: {
          street: 'Specialty Street',
          houseNumber: '1',
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
        lastName: 'Specialty',
        clinic: clinic.id,
        qualifications: ['MD'],
        languages: ['english'],
      },
      overrideAccess: true,
    })

    const link = await payload.create({
      collection: 'doctorspecialties',
      data: {
        doctor: doctor.id,
        medicalSpecialty: specialtyId,
        specializationLevel: 'expert',
        certifications: [{ certification: 'Board Certified' }],
      },
      overrideAccess: true,
    })
    createdDoctorSpecialtyIds.push(link.id)

    const updated = await payload.update({
      collection: 'doctorspecialties',
      id: link.id,
      data: { certifications: [] },
      overrideAccess: true,
    })

    expect(updated.certifications).toHaveLength(0)

    await expect(
      payload.create({
        collection: 'doctorspecialties',
        data: {
          doctor: doctor.id,
          medicalSpecialty: specialtyId,
          specializationLevel: 'expert',
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
