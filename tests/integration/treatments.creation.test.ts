import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { assertDeniedCrud } from '../fixtures/accessAssertions'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { buildRichText } from '../fixtures/richText'
import { testSlug } from '../fixtures/testSlug'
import {
  asPayloadBasicUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'
import type { Treatment } from '@/payload-types'

describe('Treatments Creation Integration Tests', () => {
  let payload: Payload
  const slugPrefix = testSlug('treatments.creation.test.ts')
  type PayloadCreateArgs = Parameters<Payload['create']>[0]
  let medicalSpecialtyId: number
  let tagId: number
  const createdBasicUserIds: Array<number> = []
  const createdPatientIds: Array<number> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    // Get baseline medical specialty
    const specialtyRes = await payload.find({
      collection: 'medical-specialties',
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })
    const specialtyDoc = specialtyRes.docs[0]
    if (!specialtyDoc) throw new Error('Expected baseline medical specialty for treatment tests')
    medicalSpecialtyId = specialtyDoc.id as number

    // Get baseline tag
    const tagRes = await payload.find({ collection: 'tags', limit: 1, overrideAccess: true, depth: 0 })
    const tagDoc = tagRes.docs[0]
    if (!tagDoc) throw new Error('Expected baseline tag for treatment tests')
    tagId = tagDoc.id as number
  }, 60000)

  afterEach(async () => {
    await cleanupTestEntities(payload, 'treatments', slugPrefix)

    await cleanupTrackedUsers(payload, {
      basicUserIds: createdBasicUserIds,
      patientIds: createdPatientIds,
    })
  })

  const createPlatformUser = (suffix: string) =>
    createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform-${suffix}`,
      lastName: `User-${suffix}`,
      createdBasicUserIds,
    })

  const createClinicUser = (suffix: string) =>
    createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-clinic-${suffix}`,
      lastName: `User-${suffix}`,
      createdBasicUserIds,
    })

  const createPatientUser = (suffix: string) =>
    createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient-${suffix}`,
      lastName: `User-${suffix}`,
      createdPatientIds,
    })

  it('creates a treatment with all required fields', async () => {
    const treatment = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-basic-treatment`,
        description: buildRichText('A basic treatment for testing'),
        medicalSpecialty: medicalSpecialtyId,
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(treatment.id).toBeDefined()
    expect(treatment.name).toBe(`${slugPrefix}-basic-treatment`)
    expect(treatment.description).toBeDefined()
    expect(treatment.medicalSpecialty).toBe(medicalSpecialtyId)
  })

  it('creates a treatment with tags', async () => {
    const treatment = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-tagged-treatment`,
        description: buildRichText('A tagged treatment'),
        medicalSpecialty: medicalSpecialtyId,
        tags: [tagId],
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(treatment.id).toBeDefined()
    expect(treatment.tags).toHaveLength(1)
    expect(treatment.tags).toContain(tagId)
  })

  it('validates required fields when creating a treatment', async () => {
    await expect(
      payload.create({
        collection: 'treatments',
        data: {
          name: `${slugPrefix}-invalid-treatment`,
          // Missing required description and medicalSpecialty
        } as Partial<Treatment>,
        overrideAccess: true,
      } as PayloadCreateArgs),
    ).rejects.toThrow()
  })

  it('initializes averagePrice as null/undefined for new treatments', async () => {
    const treatment = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-no-price-treatment`,
        description: buildRichText('A treatment with no price'),
        medicalSpecialty: medicalSpecialtyId,
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(treatment.id).toBeDefined()
    expect(treatment.averagePrice ?? null).toBeNull()
  })

  it('initializes averageRating as null/undefined for new treatments', async () => {
    const treatment = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-no-rating-treatment`,
        description: buildRichText('A treatment with no rating'),
        medicalSpecialty: medicalSpecialtyId,
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(treatment.id).toBeDefined()
    expect(treatment.averageRating ?? null).toBeNull()
  })

  it('updates treatment information', async () => {
    const treatment = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-update-treatment`,
        description: buildRichText('Original description'),
        medicalSpecialty: medicalSpecialtyId,
      },
      overrideAccess: true,
      depth: 0,
    })

    const updated = await payload.update({
      collection: 'treatments',
      id: treatment.id,
      data: {
        name: `${slugPrefix}-updated-treatment`,
        description: buildRichText('Updated description'),
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(updated.id).toBe(treatment.id)
    expect(updated.name).toBe(`${slugPrefix}-updated-treatment`)
  })

  it('soft deletes a treatment (trash functionality)', async () => {
    const treatment = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-trash-treatment`,
        description: buildRichText('A treatment to be deleted'),
        medicalSpecialty: medicalSpecialtyId,
      },
      overrideAccess: true,
      depth: 0,
    })

    // Delete (soft delete via trash)
    await payload.delete({
      collection: 'treatments',
      id: treatment.id,
      overrideAccess: true,
    })

    // Try to find the deleted treatment - it should not be in regular queries
    const findResult = await payload.find({
      collection: 'treatments',
      where: { id: { equals: treatment.id } },
      overrideAccess: true,
      depth: 0,
    })

    expect(findResult.docs).toHaveLength(0)

    // The treatment is soft-deleted, verify by trying to findByID which should throw
    await expect(
      payload.findByID({
        collection: 'treatments',
        id: treatment.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('allows anyone to read treatments (public access)', async () => {
    const treatment = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-public-treatment`,
        description: buildRichText('A publicly readable treatment'),
        medicalSpecialty: medicalSpecialtyId,
      },
      overrideAccess: true,
      depth: 0,
    })

    // Query without overrideAccess to test public read access
    const result = await payload.find({
      collection: 'treatments',
      where: { id: { equals: treatment.id } },
      depth: 0,
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs[0]?.name).toBe(`${slugPrefix}-public-treatment`)
  })

  it('allows platform writes but blocks clinic, patient, and anonymous writes', async () => {
    const platformUser = await createPlatformUser('access')
    const clinicUser = await createClinicUser('access')
    const patientUser = await createPatientUser('access')

    const platformCreated = (await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-platform-write`,
        description: buildRichText('Platform write access check'),
        medicalSpecialty: medicalSpecialtyId,
      } as unknown as Treatment,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })) as Treatment

    const deniedUsers = [
      { label: 'clinic', user: asPayloadBasicUser(clinicUser) },
      { label: 'patient', user: asPayloadPatientUser(patientUser) },
      { label: 'anonymous' as const, user: undefined },
    ]

    await assertDeniedCrud(
      deniedUsers.map((deniedUser) => ({
        create: () =>
          payload.create({
            collection: 'treatments',
            data: {
              name: `${slugPrefix}-${deniedUser.label}-write`,
              description: buildRichText(`${deniedUser.label} write should fail`),
              medicalSpecialty: medicalSpecialtyId,
            } as unknown as Treatment,
            ...(deniedUser.user ? { user: deniedUser.user } : {}),
            overrideAccess: false,
            depth: 0,
          }),
        update: () =>
          payload.update({
            collection: 'treatments',
            id: platformCreated.id,
            data: { name: `${slugPrefix}-${deniedUser.label}-update` } as unknown as Treatment,
            ...(deniedUser.user ? { user: deniedUser.user } : {}),
            overrideAccess: false,
            depth: 0,
          }),
        delete: () =>
          payload.delete({
            collection: 'treatments',
            id: platformCreated.id,
            ...(deniedUser.user ? { user: deniedUser.user } : {}),
            overrideAccess: false,
          }),
      })),
    )

    const updatedByPlatform = await payload.update({
      collection: 'treatments',
      id: platformCreated.id,
      data: { name: `${slugPrefix}-platform-update` } as unknown as Treatment,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    expect(updatedByPlatform.name).toBe(`${slugPrefix}-platform-update`)

    const deletedByPlatform = await payload.delete({
      collection: 'treatments',
      id: platformCreated.id,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
    })

    expect(deletedByPlatform.id).toBe(platformCreated.id)
  })

  it('creates multiple treatments with different specialties', async () => {
    // Get a second medical specialty if available
    const specialtyRes = await payload.find({
      collection: 'medical-specialties',
      limit: 2,
      overrideAccess: true,
      depth: 0,
    })

    const specialty1 = specialtyRes.docs[0]!.id as number
    const specialty2 = (specialtyRes.docs[1]?.id as number) ?? specialty1

    const treatment1 = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-treatment-1`,
        description: buildRichText('Treatment with specialty 1'),
        medicalSpecialty: specialty1,
      },
      overrideAccess: true,
      depth: 0,
    })

    const treatment2 = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-treatment-2`,
        description: buildRichText('Treatment with specialty 2'),
        medicalSpecialty: specialty2,
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(treatment1.id).toBeDefined()
    expect(treatment2.id).toBeDefined()
    expect(treatment1.medicalSpecialty).toBe(specialty1)
    expect(treatment2.medicalSpecialty).toBe(specialty2)
  })

  it('allows setting average fields via API', async () => {
    const treatment = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-readonly-fields`,
        description: buildRichText('Testing readonly fields'),
        medicalSpecialty: medicalSpecialtyId,
        averagePrice: 9999,
        averageRating: 5,
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(treatment.id).toBeDefined()
    expect(treatment.averagePrice).toBe(9999)
    expect(treatment.averageRating).toBe(5)
  })
})
