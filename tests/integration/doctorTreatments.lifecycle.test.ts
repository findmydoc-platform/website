import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { buildRichText } from '../fixtures/richText'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadBasicUser,
  createClinicTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'
import type { Doctor, Doctortreatment, MedicalSpecialty, Treatment } from '@/payload-types'

const createdDoctorTreatmentIds: Array<number> = []
const createdBasicUserIds: Array<number> = []
const createdTreatmentIds: Array<number> = []
const createdMedicalSpecialtyIds: Array<number> = []

describe('DoctorTreatments lifecycle integration', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  const slugPrefix = testSlug('doctorTreatments.lifecycle.test.ts')

  const createPlatformUser = async (emailPrefix: string) => {
    const basicUser = await createPlatformTestUser(payload, {
      emailPrefix,
      createdBasicUserIds,
    })

    return asPayloadBasicUser(basicUser)
  }

  const createClinicUser = async (emailPrefix: string, clinicId: number) => {
    const basicUser = await createClinicTestUser(payload, {
      emailPrefix,
      createdBasicUserIds,
    })

    return asClinicScopedPayloadUser(basicUser, clinicId)
  }

  const ensureTreatment = async () => {
    const treatmentRes = await payload.find({
      collection: 'treatments',
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })

    const existing = treatmentRes.docs[0]
    if (existing) return existing.id as number

    const specialty = (await payload.create({
      collection: 'medical-specialties',
      data: {
        name: `${slugPrefix}-specialty`,
        description: 'Test specialty',
      } as unknown as MedicalSpecialty,
      overrideAccess: true,
      depth: 0,
    })) as MedicalSpecialty

    createdMedicalSpecialtyIds.push(specialty.id)

    const treatment = (await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-treatment`,
        description: buildRichText('Treatment description'),
        medicalSpecialty: specialty.id,
      } as unknown as Treatment,
      overrideAccess: true,
      depth: 0,
    })) as Treatment

    createdTreatmentIds.push(treatment.id)

    return treatment.id as number
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for doctor treatments tests')
    cityId = cityDoc.id as number

    treatmentId = await ensureTreatment()
  }, 60000)

  afterEach(async () => {
    while (createdDoctorTreatmentIds.length) {
      const id = createdDoctorTreatmentIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'doctortreatments', id, overrideAccess: true })
      } catch {}
    }

    while (createdTreatmentIds.length) {
      const id = createdTreatmentIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'treatments', id, overrideAccess: true })
      } catch {}
    }

    while (createdMedicalSpecialtyIds.length) {
      const id = createdMedicalSpecialtyIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'medical-specialties', id, overrideAccess: true })
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

  it('creates a doctor treatment with required fields', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, { slugPrefix })

    const doctorTreatment = (await payload.create({
      collection: 'doctortreatments',
      data: {
        doctor: doctor.id,
        treatment: treatmentId,
        specializationLevel: 'specialist',
      } as unknown as Doctortreatment,
      overrideAccess: true,
      depth: 0,
    })) as Doctortreatment

    createdDoctorTreatmentIds.push(doctorTreatment.id)

    expect(doctorTreatment.doctor).toBe(doctor.id)
    expect(doctorTreatment.treatment).toBe(treatmentId)
    expect(doctorTreatment.specializationLevel).toBe('specialist')
    expect(clinic.id).toBeDefined()
  })

  it('validates required fields when creating a doctor treatment', async () => {
    const { doctor } = await createClinicFixture(payload, cityId, { slugPrefix })

    await expect(
      payload.create({
        collection: 'doctortreatments',
        data: {
          doctor: doctor.id,
        } as unknown as Doctortreatment,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('enforces unique doctor-treatment combinations', async () => {
    const { doctor } = await createClinicFixture(payload, cityId, { slugPrefix })

    const doctorTreatment = (await payload.create({
      collection: 'doctortreatments',
      data: {
        doctor: doctor.id,
        treatment: treatmentId,
        specializationLevel: 'general_practice',
      } as unknown as Doctortreatment,
      overrideAccess: true,
      depth: 0,
    })) as Doctortreatment

    createdDoctorTreatmentIds.push(doctorTreatment.id)

    await expect(
      payload.create({
        collection: 'doctortreatments',
        data: {
          doctor: doctor.id,
          treatment: treatmentId,
          specializationLevel: 'general_practice',
        } as unknown as Doctortreatment,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('rejects doctor treatments with non-existent doctor or treatment references', async () => {
    const { doctor } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-invalid-ref` })

    await expect(
      payload.create({
        collection: 'doctortreatments',
        data: {
          doctor: 99999999,
          treatment: treatmentId,
          specializationLevel: 'specialist',
        } as unknown as Doctortreatment,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()

    await expect(
      payload.create({
        collection: 'doctortreatments',
        data: {
          doctor: doctor.id,
          treatment: 99999999,
          specializationLevel: 'specialist',
        } as unknown as Doctortreatment,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('exposes doctor treatments on doctor and treatment joins', async () => {
    const { doctor } = await createClinicFixture(payload, cityId, { slugPrefix })

    const doctorTreatment = (await payload.create({
      collection: 'doctortreatments',
      data: {
        doctor: doctor.id,
        treatment: treatmentId,
        specializationLevel: 'sub_specialist',
      } as unknown as Doctortreatment,
      overrideAccess: true,
      depth: 0,
    })) as Doctortreatment

    createdDoctorTreatmentIds.push(doctorTreatment.id)

    const hydratedDoctor = (await payload.findByID({
      collection: 'doctors',
      id: doctor.id,
      overrideAccess: true,
      depth: 2,
      joins: {
        treatments: {
          limit: 10,
        },
      },
    })) as Doctor

    const doctorTreatmentIds = (hydratedDoctor.treatments?.docs ?? []).map((doc) =>
      typeof doc === 'object' ? doc.id : doc,
    )

    expect(doctorTreatmentIds).toContain(doctorTreatment.id)

    const hydratedTreatment = (await payload.findByID({
      collection: 'treatments',
      id: treatmentId,
      overrideAccess: true,
      depth: 2,
      joins: {
        Doctors: {
          limit: 10,
        },
      },
    })) as Treatment

    const treatmentJoinIds = (hydratedTreatment.Doctors?.docs ?? []).map((doc) =>
      typeof doc === 'object' ? doc.id : doc,
    )

    expect(treatmentJoinIds).toContain(doctorTreatment.id)
  })

  it('allows platform users to delete doctor treatments', async () => {
    const { doctor } = await createClinicFixture(payload, cityId, { slugPrefix })

    const doctorTreatment = (await payload.create({
      collection: 'doctortreatments',
      data: {
        doctor: doctor.id,
        treatment: treatmentId,
        specializationLevel: 'specialist',
      } as unknown as Doctortreatment,
      overrideAccess: true,
      depth: 0,
    })) as Doctortreatment

    const platformUser = await createPlatformUser(`${slugPrefix}-platform-delete`)

    await payload.delete({
      collection: 'doctortreatments',
      id: doctorTreatment.id,
      user: platformUser,
      overrideAccess: false,
    })

    await expect(
      payload.findByID({
        collection: 'doctortreatments',
        id: doctorTreatment.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('blocks clinic users from creating doctor treatments for doctors outside their clinic', async () => {
    const { clinic: ownClinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-foreign-create-own`,
    })
    const { doctor: foreignDoctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-foreign-create-foreign`,
      clinicIndex: 1,
      doctorIndex: 1,
    })

    const clinicUser = await createClinicUser(`${slugPrefix}-foreign-create-user`, ownClinic.id as number)

    await expect(
      payload.create({
        collection: 'doctortreatments',
        data: {
          doctor: foreignDoctor.id,
          treatment: treatmentId,
          specializationLevel: 'specialist',
        } as unknown as Doctortreatment,
        user: clinicUser,
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('allows clinic users to create doctor treatments and enforces clinic scope on updates', async () => {
    const { clinic: ownClinic, doctor: ownDoctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-scope-own`,
    })
    const { doctor: foreignDoctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-scope-foreign`,
      clinicIndex: 1,
      doctorIndex: 1,
    })

    const clinicUser = await createClinicUser(`${slugPrefix}-scope-user`, ownClinic.id as number)

    const ownDoctorTreatment = (await payload.create({
      collection: 'doctortreatments',
      data: {
        doctor: ownDoctor.id,
        treatment: treatmentId,
        specializationLevel: 'specialist',
      } as unknown as Doctortreatment,
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })) as Doctortreatment

    createdDoctorTreatmentIds.push(ownDoctorTreatment.id)

    const updatedOwnDoctorTreatment = (await payload.update({
      collection: 'doctortreatments',
      id: ownDoctorTreatment.id,
      data: {
        specializationLevel: 'sub_specialist',
      } as unknown as Doctortreatment,
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })) as Doctortreatment

    expect(updatedOwnDoctorTreatment.specializationLevel).toBe('sub_specialist')

    const foreignDoctorTreatment = (await payload.create({
      collection: 'doctortreatments',
      data: {
        doctor: foreignDoctor.id,
        treatment: treatmentId,
        specializationLevel: 'general_practice',
      } as unknown as Doctortreatment,
      overrideAccess: true,
      depth: 0,
    })) as Doctortreatment

    createdDoctorTreatmentIds.push(foreignDoctorTreatment.id)

    await expect(
      payload.update({
        collection: 'doctortreatments',
        id: foreignDoctorTreatment.id,
        data: {
          specializationLevel: 'specialist',
        } as unknown as Doctortreatment,
        user: clinicUser,
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow()
  })
})
