import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { slugify } from '@/utilities/slugify'
import { doctorTitles } from '@/collections/Doctors'
import { generateFullName } from '@/utilities/nameUtils'
import type { BasicUser, Doctor } from '@/payload-types'

const createdBasicUserIds: Array<number> = []

describe('Doctors lifecycle integration', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('doctors.lifecycle.test.ts')

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

  const createClinicUser = async (emailPrefix: string, clinicId: number) => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${emailPrefix}@example.com`,
        userType: 'clinic',
        firstName: 'Clinic',
        lastName: 'Tester',
        supabaseUserId: `sb-${emailPrefix}`,
      },
      overrideAccess: true,
      depth: 0,
    })) as BasicUser

    createdBasicUserIds.push(basicUser.id)

    return { ...basicUser, collection: 'basicUsers' as const, clinicId }
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for doctor lifecycle tests')
    cityId = cityDoc.id as number
  }, 60000)

  afterEach(async () => {
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

  it('creates a doctor and sets slug from fullName', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })

    const doctor = (await payload.create({
      collection: 'doctors',
      data: {
        title: 'dr',
        firstName: `${slugPrefix}-john`,
        lastName: 'Smith',
        clinic: clinic.id,
        qualifications: ['MD'],
        languages: ['english'],
      } as unknown as Doctor,
      overrideAccess: true,
      depth: 0,
    })) as Doctor

    expect(doctor.fullName).toBeDefined()
    expect(doctor.slug).toBe(slugify(doctor.fullName))
  })

  it('rejects missing required fields', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })

    await expect(
      payload.create({
        collection: 'doctors',
        data: {
          lastName: 'Missing',
          clinic: clinic.id,
          qualifications: ['MD'],
          languages: ['english'],
        } as unknown as Doctor,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('rejects invalid experienceYears values', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })

    await expect(
      payload.create({
        collection: 'doctors',
        data: {
          firstName: `${slugPrefix}-invalid-exp`,
          lastName: 'Doctor',
          clinic: clinic.id,
          qualifications: ['MD'],
          languages: ['english'],
          experienceYears: 'ten' as unknown as number,
        } as unknown as Doctor,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('requires non-empty languages', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })

    await expect(
      payload.create({
        collection: 'doctors',
        data: {
          firstName: `${slugPrefix}-no-lang`,
          lastName: 'Doctor',
          clinic: clinic.id,
          qualifications: ['MD'],
          languages: [],
        } as unknown as Doctor,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('updates fullName when title or name changes', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })

    const doctor = (await payload.create({
      collection: 'doctors',
      data: {
        title: 'dr',
        firstName: `${slugPrefix}-update`,
        lastName: 'Doctor',
        clinic: clinic.id,
        qualifications: ['MD'],
        languages: ['english'],
      } as unknown as Doctor,
      overrideAccess: true,
      depth: 0,
    })) as Doctor

    const updatedFirstName = `${slugPrefix}-updated`
    const updatedLastName = 'Doctor-Updated'

    const updatedDoctor = (await payload.update({
      collection: 'doctors',
      id: doctor.id,
      data: {
        title: 'prof_dr',
        firstName: updatedFirstName,
        lastName: updatedLastName,
      } as unknown as Doctor,
      overrideAccess: true,
      depth: 0,
    })) as Doctor

    const titleLabel = doctorTitles.find((title) => title.value === 'prof_dr')?.label
    const baseName = generateFullName(undefined, updatedFirstName, updatedLastName)
    const expectedFullName = titleLabel ? `${titleLabel} ${baseName}` : baseName

    expect(updatedDoctor.fullName).toBe(expectedFullName)
  })

  it('allows platform delete but blocks clinic delete', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })

    const doctor = (await payload.create({
      collection: 'doctors',
      data: {
        title: 'dr',
        firstName: `${slugPrefix}-delete`,
        lastName: 'Doctor',
        clinic: clinic.id,
        qualifications: ['MD'],
        languages: ['english'],
      } as unknown as Doctor,
      overrideAccess: true,
      depth: 0,
    })) as Doctor

    const clinicUser = await createClinicUser(`${slugPrefix}-clinic-user`, clinic.id as number)

    await expect(
      payload.delete({
        collection: 'doctors',
        id: doctor.id,
        user: clinicUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const platformUser = await createPlatformUser(`${slugPrefix}-platform-user`)

    await payload.delete({
      collection: 'doctors',
      id: doctor.id,
      user: platformUser,
      overrideAccess: false,
    })

    await expect(
      payload.findByID({
        collection: 'doctors',
        id: doctor.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
