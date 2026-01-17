import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'

const createdDoctorTreatmentIds: Array<number | string> = []
const createdDoctorSpecialtyIds: Array<number | string> = []

describe('Doctors integration', () => {
  let payload: Payload
  let cityId: number
  let clinicId: number | string
  let treatmentId: number
  let specialtyId: number
  const slugPrefix = testSlug('doctors.integration.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for doctor tests')
    cityId = cityDoc.id as number

    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-clinic`,
        address: {
          street: 'Doctor Street',
          houseNumber: '9',
          zipCode: 12345,
          country: 'Turkey',
          city: cityId,
        },
        contact: {
          phoneNumber: '+90 555 1234567',
          email: `${slugPrefix}@example.com`,
        },
        supportedLanguages: ['english'],
        status: 'approved',
      },
      overrideAccess: true,
    })
    clinicId = clinic.id

    const treatmentRes = await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })
    const treatmentDoc = treatmentRes.docs[0]
    if (!treatmentDoc) throw new Error('Expected baseline treatment for doctor tests')
    treatmentId = treatmentDoc.id as number

    const specialtyRes = await payload.find({
      collection: 'medical-specialties',
      limit: 1,
      overrideAccess: true,
    })
    const specialtyDoc = specialtyRes.docs[0]
    if (!specialtyDoc) throw new Error('Expected baseline specialty for doctor tests')
    specialtyId = specialtyDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdDoctorTreatmentIds.length) {
      const id = createdDoctorTreatmentIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'doctortreatments', id, overrideAccess: true })
    }

    while (createdDoctorSpecialtyIds.length) {
      const id = createdDoctorSpecialtyIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'doctorspecialties', id, overrideAccess: true })
    }

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('creates a doctor and generates fullName and slug', async () => {
    const doctor = await payload.create({
      collection: 'doctors',
      data: {
        firstName: `${slugPrefix}-John`,
        lastName: 'Doe',
        title: 'dr',
        clinic: clinicId,
        qualifications: ['MD'],
        languages: ['english'],
      },
      overrideAccess: true,
    })

    expect(doctor.fullName).toContain('Dr.')
    expect(doctor.slug).toContain(`${slugPrefix}-john-doe`)
  })

  it('rejects missing qualifications', async () => {
    await expect(
      payload.create({
        collection: 'doctors',
        data: {
          firstName: `${slugPrefix}-NoQual`,
          lastName: 'Doctor',
          clinic: clinicId,
          languages: ['english'],
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('creates doctor treatment and specialty joins', async () => {
    const doctor = await payload.create({
      collection: 'doctors',
      data: {
        firstName: `${slugPrefix}-Join`,
        lastName: 'Doctor',
        clinic: clinicId,
        qualifications: ['MD'],
        languages: ['english'],
      },
      overrideAccess: true,
    })

    const doctorTreatment = await payload.create({
      collection: 'doctortreatments',
      data: {
        doctor: doctor.id,
        treatment: treatmentId,
        specializationLevel: 'expert',
      },
      overrideAccess: true,
    })
    createdDoctorTreatmentIds.push(doctorTreatment.id)

    const doctorSpecialty = await payload.create({
      collection: 'doctorspecialties',
      data: {
        doctor: doctor.id,
        medicalSpecialty: specialtyId,
        specializationLevel: 'expert',
        certifications: [{ certification: 'Board Certified' }],
      },
      overrideAccess: true,
    })
    createdDoctorSpecialtyIds.push(doctorSpecialty.id)

    const updatedDoctor = await payload.findByID({
      collection: 'doctors',
      id: doctor.id,
      overrideAccess: true,
    })

    expect(updatedDoctor.treatments).toBeDefined()
    expect(updatedDoctor.specialties).toBeDefined()
  })
})
