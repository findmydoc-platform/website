import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadBasicUser,
  createClinicTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'
import { slugify } from '@/utilities/slugify'
import { doctorTitles } from '@/collections/Doctors'
import { generateFullName } from '@/utilities/nameUtils'
import type { Doctor } from '@/payload-types'

const createdBasicUserIds: Array<number> = []

describe('Doctors lifecycle integration', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('doctors.lifecycle.test.ts')

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
        gender: 'male',
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
          gender: 'male',
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
          gender: 'male',
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
        gender: 'male',
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

  it('auto-assigns clinic for clinic users when clinic is omitted', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-auto-assign` })
    const clinicUser = await createClinicUser(`${slugPrefix}-auto-assign-user`, clinic.id as number)

    const doctor = (await payload.create({
      collection: 'doctors',
      data: {
        title: 'dr',
        gender: 'female',
        firstName: `${slugPrefix}-auto`,
        lastName: 'Doctor',
        qualifications: ['MD'],
        languages: ['english'],
      } as unknown as Doctor,
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })) as Doctor

    expect(doctor.clinic).toBe(clinic.id)
  })

  it('blocks clinic users from creating doctors for foreign clinics', async () => {
    const { clinic: ownClinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-foreign-create-own`,
    })
    const { clinic: foreignClinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-foreign-create-foreign`,
      clinicIndex: 1,
      doctorIndex: 1,
    })

    const clinicUser = await createClinicUser(`${slugPrefix}-foreign-create-user`, ownClinic.id as number)

    await expect(
      payload.create({
        collection: 'doctors',
        data: {
          title: 'dr',
          firstName: `${slugPrefix}-foreign-create`,
          lastName: 'Doctor',
          clinic: foreignClinic.id,
          qualifications: ['MD'],
          languages: ['english'],
        } as unknown as Doctor,
        user: clinicUser,
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('allows clinic users to create doctors and enforces clinic scope on updates', async () => {
    const { clinic: ownClinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-scope-own`,
    })
    const { clinic: foreignClinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-scope-foreign`,
      clinicIndex: 1,
      doctorIndex: 1,
    })

    const clinicUser = await createClinicUser(`${slugPrefix}-scope-user`, ownClinic.id as number)

    const ownDoctor = (await payload.create({
      collection: 'doctors',
      data: {
        title: 'dr',
        gender: 'male',
        firstName: `${slugPrefix}-scope-own-create`,
        lastName: 'Doctor',
        clinic: ownClinic.id,
        qualifications: ['MD'],
        languages: ['english'],
      } as unknown as Doctor,
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })) as Doctor

    const updatedOwnDoctor = (await payload.update({
      collection: 'doctors',
      id: ownDoctor.id,
      data: {
        firstName: `${slugPrefix}-scope-own-updated`,
      } as unknown as Doctor,
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })) as Doctor

    expect(updatedOwnDoctor.firstName).toBe(`${slugPrefix}-scope-own-updated`)

    const foreignDoctor = (await payload.create({
      collection: 'doctors',
      data: {
        title: 'dr',
        gender: 'male',
        firstName: `${slugPrefix}-scope-foreign-existing`,
        lastName: 'Doctor',
        clinic: foreignClinic.id,
        qualifications: ['MD'],
        languages: ['english'],
      } as unknown as Doctor,
      overrideAccess: true,
      depth: 0,
    })) as Doctor

    await expect(
      payload.update({
        collection: 'doctors',
        id: foreignDoctor.id,
        data: {
          firstName: `${slugPrefix}-scope-foreign-updated`,
        } as unknown as Doctor,
        user: clinicUser,
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('allows platform delete but blocks clinic delete', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })

    const doctor = (await payload.create({
      collection: 'doctors',
      data: {
        title: 'dr',
        gender: 'male',
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
