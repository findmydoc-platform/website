/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'

describe('Treatments Creation Integration Tests', () => {
  let payload: Payload
  const slugPrefix = testSlug('treatments.creation.test.ts')
  let medicalSpecialtyId: number
  let tagId: number

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
  })

  it('creates a treatment with all required fields', async () => {
    const treatment = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-basic-treatment`,
        description: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'text', text: 'A basic treatment for testing' }],
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
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
        description: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'text', text: 'A tagged treatment' }],
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
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
        } as any,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('initializes averagePrice as null/undefined for new treatments', async () => {
    const treatment = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-no-price-treatment`,
        description: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'text', text: 'A treatment with no price' }],
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
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
        description: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'text', text: 'A treatment with no rating' }],
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
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
        description: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'text', text: 'Original description' }],
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
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
        description: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'text', text: 'Updated description' }],
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
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
        description: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'text', text: 'A treatment to be deleted' }],
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
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
        description: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'text', text: 'A publicly readable treatment' }],
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
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
        description: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'text', text: 'Treatment with specialty 1' }],
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
        medicalSpecialty: specialty1,
      },
      overrideAccess: true,
      depth: 0,
    })

    const treatment2 = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-treatment-2`,
        description: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'text', text: 'Treatment with specialty 2' }],
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
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
        description: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'text', text: 'Testing readonly fields' }],
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
        medicalSpecialty: medicalSpecialtyId,
        averagePrice: 9999,
        averageRating: 5,
      } as any,
      overrideAccess: true,
      depth: 0,
    })

    expect(treatment.id).toBeDefined()
    expect(treatment.averagePrice).toBe(9999)
    expect(treatment.averageRating).toBe(5)
  })
})
