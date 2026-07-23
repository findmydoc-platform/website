import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { getPayload, ValidationError } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { cleanupTrackedDocs } from '../fixtures/cleanupTrackedDocs'
import { createTinyPngFile } from '../fixtures/mediaFile'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  createClinicTestUser,
  createPlatformTestUser,
  cleanupTrackedUsers,
} from '../fixtures/testUsers'
import { slugify } from '@/utilities/slugify'
import { doctorTitles } from '@/collections/Doctors'
import { generateFullName } from '@/utilities/nameUtils'
import type { Doctor, DoctorMedia } from '@/payload-types'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

const createdStaffIds: Array<number | string> = []
type PayloadCreateArgs = Parameters<Payload['create']>[0]

describe('Doctors lifecycle integration', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('doctors.lifecycle.test.ts')
  const createdMediaIds: Array<number> = []

  const createPlatformUser = async (emailPrefix: string) => {
    const staffUser = await createPlatformTestUser(payload, {
      emailPrefix,
      createdStaffIds,
    })

    return asPayloadStaffUser(staffUser)
  }

  const createClinicUser = async (emailPrefix: string, clinicId: number) => {
    const staffUser = await createClinicTestUser(payload, {
      emailPrefix,
      createdStaffIds,
    })

    return asClinicScopedPayloadUser(payload, staffUser, clinicId)
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
    await cleanupTrackedDocs(payload, [{ collection: 'doctorMedia', ids: createdMediaIds }])
    await cleanupTrackedUsers(payload, { staffIds: createdStaffIds })

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('validates profile image ownership on create, assignment, and clinic changes', async () => {
    const { clinic: clinicA, doctor: doctorA } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-profile-a`,
    })
    const { clinic: clinicB, doctor: doctorB } = await createClinicFixture(payload, cityId, {
      clinicIndex: 1,
      doctorIndex: 1,
      slugPrefix: `${slugPrefix}-profile-b`,
    })
    const platformUser = await createPlatformUser(`${slugPrefix}-profile-platform`)

    const createMedia = async (doctor: Doctor, suffix: string) => {
      const media = (await payload.create({
        collection: 'doctorMedia',
        data: { alt: `Profile ${suffix}`, doctor: doctor.id } as Partial<DoctorMedia>,
        file: createTinyPngFile(`${slugPrefix}-${suffix}.png`),
        user: platformUser,
        overrideAccess: false,
        depth: 0,
      } as PayloadCreateArgs)) as DoctorMedia
      createdMediaIds.push(media.id)
      return media
    }

    const mediaA = await createMedia(doctorA as Doctor, 'profile-a')
    const mediaB = await createMedia(doctorB as Doctor, 'profile-b')

    const createWithImage = payload.create({
      collection: 'doctors',
      data: {
        firstName: `${slugPrefix}-profile-create`,
        gender: 'female',
        lastName: 'Doctor',
        clinic: clinicA.id,
        profileImage: mediaA.id,
        qualifications: ['MD'],
        languages: ['english'],
      } as unknown as Doctor,
      user: platformUser,
      overrideAccess: false,
      depth: 0,
    })

    await expect(createWithImage).rejects.toBeInstanceOf(ValidationError)
    await expect(createWithImage).rejects.toMatchObject({
      data: {
        errors: [
          expect.objectContaining({
            message: 'Save the doctor before assigning a profile image.',
            path: 'profileImage',
          }),
        ],
      },
      status: 400,
    })

    const assigned = (await payload.update({
      collection: 'doctors',
      id: doctorA.id,
      data: { profileImage: mediaA.id },
      user: platformUser,
      overrideAccess: false,
      depth: 0,
    })) as Doctor
    expect(assigned.profileImage).toBe(mediaA.id)

    const wrongDoctor = payload.update({
      collection: 'doctors',
      id: doctorA.id,
      data: { profileImage: mediaB.id },
      user: platformUser,
      overrideAccess: false,
      depth: 0,
    })
    await expect(wrongDoctor).rejects.toMatchObject({
      data: {
        errors: [
          expect.objectContaining({
            message: 'Selected profile image does not belong to this doctor.',
            path: 'profileImage',
          }),
        ],
      },
      status: 400,
    })

    const sameClinicDoctor = (await payload.create({
      collection: 'doctors',
      data: {
        firstName: `${slugPrefix}-profile-same-clinic`,
        gender: 'female',
        lastName: 'Doctor',
        clinic: clinicA.id,
        qualifications: ['MD'],
        languages: ['english'],
      } as unknown as Doctor,
      user: platformUser,
      overrideAccess: false,
      depth: 0,
    })) as Doctor
    const sameClinicMedia = await createMedia(sameClinicDoctor, 'profile-same-clinic')
    const clinicUser = await createClinicUser(`${slugPrefix}-profile-clinic`, clinicA.id)

    const spoofedDoctorId = payload.update({
      collection: 'doctors',
      id: doctorA.id,
      data: {
        id: sameClinicDoctor.id,
        profileImage: sameClinicMedia.id,
      } as unknown as Partial<Doctor>,
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })
    await expect(spoofedDoctorId).rejects.toMatchObject({
      data: {
        errors: [expect.objectContaining({ path: 'profileImage' })],
      },
      status: 400,
    })
    await expect(
      payload.findByID({
        collection: 'doctors',
        id: doctorA.id,
        overrideAccess: true,
        depth: 0,
      }),
    ).resolves.toMatchObject({ profileImage: mediaA.id })

    const clinicChange = payload.update({
      collection: 'doctors',
      id: doctorA.id,
      data: { clinic: clinicB.id },
      user: platformUser,
      overrideAccess: false,
      depth: 0,
    })
    await expect(clinicChange).rejects.toMatchObject({
      data: {
        errors: [
          expect.objectContaining({
            message: "Selected profile image does not belong to this doctor's clinic.",
            path: 'profileImage',
          }),
        ],
      },
      status: 400,
    })
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

  it('lets clinic staff toggle their doctors while keeping inactive doctors private', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-active-state` })
    const clinicUser = await createClinicUser(`${slugPrefix}-active-state-clinic`, clinic.id as number)
    const platformUser = await createPlatformUser(`${slugPrefix}-active-state-platform`)

    const doctor = (await payload.create({
      collection: 'doctors',
      data: {
        title: 'dr',
        gender: 'female',
        firstName: `${slugPrefix}-active-state`,
        lastName: 'Doctor',
        clinic: clinic.id,
        qualifications: ['MD'],
        languages: ['english'],
      } as unknown as Doctor,
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })) as Doctor

    expect(doctor.active).toBe(true)

    const deactivated = (await payload.update({
      collection: 'doctors',
      id: doctor.id,
      data: { active: false },
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })) as Doctor

    expect(deactivated.active).toBe(false)

    const publicRead = await payload.find({
      collection: 'doctors',
      where: { id: { equals: doctor.id } },
      overrideAccess: false,
      depth: 0,
    })
    expect(publicRead.docs).toHaveLength(0)

    const clinicRead = await payload.find({
      collection: 'doctors',
      where: { id: { equals: doctor.id } },
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })
    expect(clinicRead.docs).toHaveLength(1)

    const platformRead = await payload.find({
      collection: 'doctors',
      where: { id: { equals: doctor.id } },
      user: platformUser,
      overrideAccess: false,
      depth: 0,
    })
    expect(platformRead.docs).toHaveLength(1)

    await payload.update({
      collection: 'doctors',
      id: doctor.id,
      data: { active: true },
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })

    const reactivatedPublicRead = await payload.find({
      collection: 'doctors',
      where: { id: { equals: doctor.id } },
      overrideAccess: false,
      depth: 0,
    })
    expect(reactivatedPublicRead.docs).toHaveLength(1)
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
