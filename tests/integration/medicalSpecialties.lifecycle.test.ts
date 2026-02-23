import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { assertDeniedCrud } from '../fixtures/accessAssertions'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import {
  asPayloadBasicUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'
import type { Doctorspecialty, MedicalSpecialty } from '@/payload-types'

function breadcrumbLabels(specialty: MedicalSpecialty): string[] {
  return (specialty.breadcrumbs ?? [])
    .map((entry) => (entry && typeof entry === 'object' && 'label' in entry ? entry.label : null))
    .filter((label): label is string => typeof label === 'string')
}

describe('MedicalSpecialties lifecycle integration', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('medicalSpecialties.lifecycle.test.ts')
  const createdSpecialtyIds: Array<number> = []
  const createdDoctorSpecialtyIds: Array<number> = []
  const createdUserIds: Array<number> = []
  const createdPatientIds: Array<number> = []

  const createPlatformUser = (suffix: string) =>
    createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-${suffix}`,
      lastName: `User-${suffix}`,
      createdBasicUserIds: createdUserIds,
    })

  const createClinicUser = (suffix: string) =>
    createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-clinic-${suffix}`,
      lastName: `User-${suffix}`,
      createdBasicUserIds: createdUserIds,
    })

  const createPatientUser = (suffix: string) =>
    createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient-${suffix}`,
      lastName: `User-${suffix}`,
      createdPatientIds: createdPatientIds,
    })

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

    await cleanupTrackedUsers(payload, {
      basicUserIds: createdUserIds,
      patientIds: createdPatientIds,
    })

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
      user: asPayloadBasicUser(platformUser),
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
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty

    createdSpecialtyIds.push(child.id)

    expect(child.parentSpecialty).toBe(parent.id)

    const hydratedChild = (await payload.findByID({
      collection: 'medical-specialties',
      id: child.id,
      overrideAccess: true,
      depth: 0,
    })) as MedicalSpecialty

    expect(breadcrumbLabels(hydratedChild)).toEqual(['Cosmetic Surgery', 'Facial Procedures'])
  })

  it('updates specialty hierarchy and fields', async () => {
    const platformUser = await createPlatformUser('update')

    const parentA = (await payload.create({
      collection: 'medical-specialties',
      data: {
        name: 'Orthopedics',
        description: 'Parent A',
      } as unknown as MedicalSpecialty,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty

    const parentB = (await payload.create({
      collection: 'medical-specialties',
      data: {
        name: 'Sports Medicine',
        description: 'Parent B',
      } as unknown as MedicalSpecialty,
      user: asPayloadBasicUser(platformUser),
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
      user: asPayloadBasicUser(platformUser),
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
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty

    expect(updated.description).toBe('Updated child specialty')
    expect(updated.parentSpecialty).toBe(parentB.id)

    const reparentedChild = (await payload.findByID({
      collection: 'medical-specialties',
      id: child.id,
      overrideAccess: true,
      depth: 0,
    })) as MedicalSpecialty

    expect(breadcrumbLabels(reparentedChild)).toEqual(['Sports Medicine', 'Joint Care'])

    await payload.update({
      collection: 'medical-specialties',
      id: parentB.id,
      data: {
        name: 'Sports Medicine Updated',
      },
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    const childAfterParentRename = (await payload.findByID({
      collection: 'medical-specialties',
      id: child.id,
      overrideAccess: true,
      depth: 0,
    })) as MedicalSpecialty

    expect(breadcrumbLabels(childAfterParentRename)).toEqual(['Sports Medicine Updated', 'Joint Care'])
  })

  it('rejects level-3 specialty nesting and self-parent references', async () => {
    const platformUser = await createPlatformUser('hierarchy-enforcement')

    const root = (await payload.create({
      collection: 'medical-specialties',
      data: {
        name: 'Root Specialty',
        description: 'Level 1 specialty',
      } as unknown as MedicalSpecialty,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty
    createdSpecialtyIds.push(root.id)

    const child = (await payload.create({
      collection: 'medical-specialties',
      data: {
        name: 'Child Specialty',
        description: 'Level 2 specialty',
        parentSpecialty: root.id,
      } as unknown as MedicalSpecialty,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty
    createdSpecialtyIds.push(child.id)

    await expect(
      payload.create({
        collection: 'medical-specialties',
        data: {
          name: 'Grandchild Specialty',
          description: 'Should be rejected as level 3',
          parentSpecialty: child.id,
        } as unknown as MedicalSpecialty,
        user: asPayloadBasicUser(platformUser),
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow('Only two hierarchy levels are allowed for medical specialties')

    await expect(
      payload.update({
        collection: 'medical-specialties',
        id: root.id,
        data: {
          parentSpecialty: root.id,
        },
        user: asPayloadBasicUser(platformUser),
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow('A medical specialty cannot be its own parent')
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
      user: asPayloadBasicUser(platformUser),
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
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty

    await payload.delete({
      collection: 'medical-specialties',
      id: specialty.id,
      user: asPayloadBasicUser(platformUser),
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

  it('allows platform writes but blocks clinic, patient, and anonymous writes', async () => {
    const platformUser = await createPlatformUser('access-platform')
    const clinicUser = await createClinicUser('access-clinic')
    const patientUser = await createPatientUser('access-patient')

    const createdByPlatform = (await payload.create({
      collection: 'medical-specialties',
      data: {
        name: `${slugPrefix}-platform-write`,
        description: 'Platform can create specialties',
      } as unknown as MedicalSpecialty,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as MedicalSpecialty

    createdSpecialtyIds.push(createdByPlatform.id)

    const deniedUsers = [
      { label: 'clinic', user: asPayloadBasicUser(clinicUser) },
      { label: 'patient', user: asPayloadPatientUser(patientUser) },
      { label: 'anonymous' as const, user: undefined },
    ]

    await assertDeniedCrud(
      deniedUsers.map((deniedUser) => ({
        create: () =>
          payload.create({
            collection: 'medical-specialties',
            data: {
              name: `${slugPrefix}-${deniedUser.label}-write`,
              description: `${deniedUser.label} write should fail`,
            } as unknown as MedicalSpecialty,
            ...(deniedUser.user ? { user: deniedUser.user } : {}),
            overrideAccess: false,
            depth: 0,
          }),
        update: () =>
          payload.update({
            collection: 'medical-specialties',
            id: createdByPlatform.id,
            data: { description: `${deniedUser.label} update should fail` },
            ...(deniedUser.user ? { user: deniedUser.user } : {}),
            overrideAccess: false,
            depth: 0,
          }),
        delete: () =>
          payload.delete({
            collection: 'medical-specialties',
            id: createdByPlatform.id,
            ...(deniedUser.user ? { user: deniedUser.user } : {}),
            overrideAccess: false,
          }),
      })),
    )

    const updatedByPlatform = await payload.update({
      collection: 'medical-specialties',
      id: createdByPlatform.id,
      data: { description: 'Platform update works' },
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    expect(updatedByPlatform.description).toBe('Platform update works')
  })
})
