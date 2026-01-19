import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, Doctor, Doctorspecialty, MedicalSpecialty } from '@/payload-types'

const createdDoctorSpecialtyIds: Array<number> = []
const createdMedicalSpecialtyIds: Array<number> = []
const createdBasicUserIds: Array<number> = []

describe('DoctorSpecialties lifecycle integration', () => {
  let payload: Payload
  let cityId: number
  let medicalSpecialtyId: number
  const slugPrefix = testSlug('doctorSpecialties.lifecycle.test.ts')

  const createPlatformUser = async (emailPrefix: string) => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${emailPrefix}@example.com`,
        userType: 'platform',
        firstName: 'Platform',
        lastName: 'Tester',
        supabaseUserId: `sb-${emailPrefix}`,
      },
      overrideAccess: true,
      depth: 0,
    })) as BasicUser

    createdBasicUserIds.push(basicUser.id)

    return { ...basicUser, collection: 'basicUsers' as const }
  }

  const ensureMedicalSpecialty = async () => {
    const specialtyRes = await payload.find({
      collection: 'medical-specialties',
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })

    const existing = specialtyRes.docs[0]
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

    return specialty.id as number
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for doctor specialties tests')
    cityId = cityDoc.id as number

    medicalSpecialtyId = await ensureMedicalSpecialty()
  }, 60000)

  afterEach(async () => {
    while (createdDoctorSpecialtyIds.length) {
      const id = createdDoctorSpecialtyIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'doctorspecialties', id, overrideAccess: true })
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

  it('creates a doctor specialty with certifications', async () => {
    const { doctor } = await createClinicFixture(payload, cityId, { slugPrefix })

    const doctorSpecialty = (await payload.create({
      collection: 'doctorspecialties',
      data: {
        doctor: doctor.id,
        medicalSpecialty: medicalSpecialtyId,
        specializationLevel: 'expert',
        certifications: [{ certification: 'Board Certified' }],
      } as unknown as Doctorspecialty,
      overrideAccess: true,
      depth: 0,
    })) as Doctorspecialty

    createdDoctorSpecialtyIds.push(doctorSpecialty.id)

    expect(doctorSpecialty.doctor).toBe(doctor.id)
    expect(doctorSpecialty.medicalSpecialty).toBe(medicalSpecialtyId)
    expect(doctorSpecialty.certifications?.length).toBe(1)
  })

  it('validates required fields when creating a doctor specialty', async () => {
    const { doctor } = await createClinicFixture(payload, cityId, { slugPrefix })

    await expect(
      payload.create({
        collection: 'doctorspecialties',
        data: {
          doctor: doctor.id,
        } as unknown as Doctorspecialty,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('enforces unique doctor-specialty combinations', async () => {
    const { doctor } = await createClinicFixture(payload, cityId, { slugPrefix })

    const doctorSpecialty = (await payload.create({
      collection: 'doctorspecialties',
      data: {
        doctor: doctor.id,
        medicalSpecialty: medicalSpecialtyId,
        specializationLevel: 'advanced',
      } as unknown as Doctorspecialty,
      overrideAccess: true,
      depth: 0,
    })) as Doctorspecialty

    createdDoctorSpecialtyIds.push(doctorSpecialty.id)

    await expect(
      payload.create({
        collection: 'doctorspecialties',
        data: {
          doctor: doctor.id,
          medicalSpecialty: medicalSpecialtyId,
          specializationLevel: 'advanced',
        } as unknown as Doctorspecialty,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('exposes doctor specialties on doctor and medical specialty joins', async () => {
    const { doctor } = await createClinicFixture(payload, cityId, { slugPrefix })

    const doctorSpecialty = (await payload.create({
      collection: 'doctorspecialties',
      data: {
        doctor: doctor.id,
        medicalSpecialty: medicalSpecialtyId,
        specializationLevel: 'specialist',
      } as unknown as Doctorspecialty,
      overrideAccess: true,
      depth: 0,
    })) as Doctorspecialty

    createdDoctorSpecialtyIds.push(doctorSpecialty.id)

    const hydratedDoctor = (await payload.findByID({
      collection: 'doctors',
      id: doctor.id,
      overrideAccess: true,
      depth: 2,
      joins: {
        specialties: {
          limit: 10,
        },
      },
    })) as Doctor

    const specialtyJoinIds = (hydratedDoctor.specialties?.docs ?? []).map((doc) =>
      typeof doc === 'object' ? doc.id : doc,
    )

    expect(specialtyJoinIds).toContain(doctorSpecialty.id)

    const hydratedSpecialty = (await payload.findByID({
      collection: 'medical-specialties',
      id: medicalSpecialtyId,
      overrideAccess: true,
      depth: 2,
      joins: {
        doctorLinks: {
          limit: 10,
        },
      },
    })) as MedicalSpecialty

    const doctorLinkIds = (hydratedSpecialty.doctorLinks?.docs ?? []).map((doc) =>
      typeof doc === 'object' ? doc.id : doc,
    )

    expect(doctorLinkIds).toContain(doctorSpecialty.id)
  })

  it('updates specialization level and certifications', async () => {
    const { doctor } = await createClinicFixture(payload, cityId, { slugPrefix })

    const doctorSpecialty = (await payload.create({
      collection: 'doctorspecialties',
      data: {
        doctor: doctor.id,
        medicalSpecialty: medicalSpecialtyId,
        specializationLevel: 'beginner',
        certifications: [],
      } as unknown as Doctorspecialty,
      overrideAccess: true,
      depth: 0,
    })) as Doctorspecialty

    createdDoctorSpecialtyIds.push(doctorSpecialty.id)

    const updated = (await payload.update({
      collection: 'doctorspecialties',
      id: doctorSpecialty.id,
      data: {
        specializationLevel: 'advanced',
        certifications: [{ certification: 'Advanced Certification' }],
      } as unknown as Doctorspecialty,
      overrideAccess: true,
      depth: 0,
    })) as Doctorspecialty

    expect(updated.specializationLevel).toBe('advanced')
    expect(updated.certifications?.length).toBe(1)
  })

  it('allows platform users to delete doctor specialties', async () => {
    const { doctor } = await createClinicFixture(payload, cityId, { slugPrefix })

    const doctorSpecialty = (await payload.create({
      collection: 'doctorspecialties',
      data: {
        doctor: doctor.id,
        medicalSpecialty: medicalSpecialtyId,
        specializationLevel: 'intermediate',
      } as unknown as Doctorspecialty,
      overrideAccess: true,
      depth: 0,
    })) as Doctorspecialty

    const platformUser = await createPlatformUser(`${slugPrefix}-platform-delete`)

    await payload.delete({
      collection: 'doctorspecialties',
      id: doctorSpecialty.id,
      user: platformUser,
      overrideAccess: false,
    })

    await expect(
      payload.findByID({
        collection: 'doctorspecialties',
        id: doctorSpecialty.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
