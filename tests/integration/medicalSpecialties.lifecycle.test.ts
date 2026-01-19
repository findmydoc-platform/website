import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, Doctorspecialty, MedicalSpecialty } from '@/payload-types'

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>

describe('MedicalSpecialties lifecycle integration', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('medicalSpecialties.lifecycle.test.ts')
  const createdSpecialtyIds: Array<number> = []
  const createdDoctorSpecialtyIds: Array<number> = []
  const createdUserIds: Array<number> = []

  const asPayloadUser = (user: BasicUser): PayloadUser =>
    ({
      ...user,
      collection: 'basicUsers',
    }) as unknown as PayloadUser

  const createPlatformUser = async (suffix: string) => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}-${suffix}@example.com`,
        userType: 'platform',
        firstName: 'Platform',
        lastName: `User-${suffix}`,
        supabaseUserId: `sb-${slugPrefix}-${suffix}`,
      },
      overrideAccess: true,
      depth: 0,
    })) as BasicUser

    createdUserIds.push(basicUser.id)

    return basicUser
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for medical specialties tests')
    cityId = cityDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdDoctorSpecialtyIds.length) {
      const id = createdDoctorSpecialtyIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'doctorspecialties', id, overrideAccess: true })
      } catch {}
    }

    while (createdSpecialtyIds.length) {
      const id = createdSpecialtyIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'medical-specialties', id, overrideAccess: true })
      } catch {}
    }

    while (createdUserIds.length) {
      const id = createdUserIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
      } catch {}
    }

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('creates medical specialties with and without parent specialty', async () => {
    const platformUser = await createPlatformUser('create')

    const parent = (await payload.create({
      collection: 'medical-specialties',
      data: {
        name: 'Cosmetic Surgery',
        description: 'Parent specialty',
      } as unknown as MedicalSpecialty,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty

    createdSpecialtyIds.push(parent.id)

    const child = (await payload.create({
      collection: 'medical-specialties',
      data: {
        name: 'Facial Procedures',
        description: 'Child specialty',
        parentSpecialty: parent.id,
      } as unknown as MedicalSpecialty,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty

    createdSpecialtyIds.push(child.id)

    expect(child.parentSpecialty).toBe(parent.id)
  })

  it('updates specialty hierarchy and fields', async () => {
    const platformUser = await createPlatformUser('update')

    const parentA = (await payload.create({
      collection: 'medical-specialties',
      data: {
        name: 'Orthopedics',
        description: 'Parent A',
      } as unknown as MedicalSpecialty,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty

    const parentB = (await payload.create({
      collection: 'medical-specialties',
      data: {
        name: 'Sports Medicine',
        description: 'Parent B',
      } as unknown as MedicalSpecialty,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty

    const child = (await payload.create({
      collection: 'medical-specialties',
      data: {
        name: 'Joint Care',
        description: 'Child specialty',
        parentSpecialty: parentA.id,
      } as unknown as MedicalSpecialty,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty

    createdSpecialtyIds.push(parentA.id, parentB.id, child.id)

    const updated = (await payload.update({
      collection: 'medical-specialties',
      id: child.id,
      data: {
        description: 'Updated child specialty',
        parentSpecialty: parentB.id,
      },
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty

    expect(updated.description).toBe('Updated child specialty')
    expect(updated.parentSpecialty).toBe(parentB.id)
  })

  it('exposes doctorLinks join for medical specialties', async () => {
    const platformUser = await createPlatformUser('join')
    const { doctor } = await createClinicFixture(payload, cityId, { slugPrefix })

    const specialty = (await payload.create({
      collection: 'medical-specialties',
      data: {
        name: 'Dermatology',
        description: 'Skin-related care',
      } as unknown as MedicalSpecialty,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty

    createdSpecialtyIds.push(specialty.id)

    const doctorSpecialty = (await payload.create({
      collection: 'doctorspecialties',
      data: {
        doctor: doctor.id,
        medicalSpecialty: specialty.id,
        specializationLevel: 'expert',
      } as unknown as Doctorspecialty,
      overrideAccess: true,
      depth: 0,
    })) as Doctorspecialty

    createdDoctorSpecialtyIds.push(doctorSpecialty.id)

    const hydratedSpecialty = (await payload.findByID({
      collection: 'medical-specialties',
      id: specialty.id,
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

  it('deletes medical specialties', async () => {
    const platformUser = await createPlatformUser('delete')

    const specialty = (await payload.create({
      collection: 'medical-specialties',
      data: {
        name: 'General Practice',
        description: 'Primary care',
      } as unknown as MedicalSpecialty,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty

    await payload.delete({
      collection: 'medical-specialties',
      id: specialty.id,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
    })

    await expect(
      payload.findByID({
        collection: 'medical-specialties',
        id: specialty.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
