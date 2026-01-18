/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { Clinic } from '@/payload-types'

describe('Clinic Creation Integration Tests', () => {
  let payload: Payload
  const slugPrefix = testSlug('clinics.creation.test.ts')
  let cityId: number
  let tagId: number

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    // Get baseline city for clinic address
    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for clinic creation tests')
    cityId = cityDoc.id as number

    // Get baseline tag for clinic tagging
    const tagRes = await payload.find({ collection: 'tags', limit: 1, overrideAccess: true, depth: 0 })
    const tagDoc = tagRes.docs[0]
    if (!tagDoc) throw new Error('Expected baseline tag for clinic creation tests')
    tagId = tagDoc.id as number
  }, 60000)

  afterEach(async () => {
    await cleanupTestEntities(payload, 'clinictreatments', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('creates a clinic with all required fields', async () => {
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-basic-clinic`,
        address: {
          street: 'Test Street',
          houseNumber: '123',
          zipCode: 34000,
          country: 'Turkey',
          city: cityId,
        },
        contact: {
          phoneNumber: '+90 555 1234567',
          email: `${slugPrefix}@test.com`,
          website: 'https://example.com',
        },
        supportedLanguages: ['english', 'turkish'],
        status: 'draft',
        slug: `${slugPrefix}-basic-clinic`,
      },
      draft: false,
      overrideAccess: true,
      depth: 0,
    })

    expect(clinic.id).toBeDefined()
    expect(clinic.name).toBe(`${slugPrefix}-basic-clinic`)
    expect(clinic.address.city).toBe(cityId)
    expect(clinic.contact.email).toBe(`${slugPrefix}@test.com`)
    expect(clinic.status).toBe('draft')
    expect(clinic.supportedLanguages).toEqual(['english', 'turkish'])
  })

  it('creates a clinic with description and tags', async () => {
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-tagged-clinic`,
        description: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'text', text: 'A test clinic with description' }],
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
        tags: [tagId],
        address: {
          street: 'Tagged Street',
          houseNumber: '456',
          zipCode: 34100,
          country: 'Turkey',
          city: cityId,
        },
        contact: {
          phoneNumber: '+90 555 9876543',
          email: `${slugPrefix}-tagged@test.com`,
        },
        supportedLanguages: ['english'],
        status: 'draft',
        slug: `${slugPrefix}-tagged-clinic`,
      },
      draft: false,
      overrideAccess: true,
      depth: 0,
    })

    expect(clinic.id).toBeDefined()
    expect(clinic.description).toBeDefined()
    expect(clinic.tags).toHaveLength(1)
    expect(clinic.tags).toContain(tagId)
  })

  it('creates a clinic with coordinates', async () => {
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-geo-clinic`,
        coordinates: [41.0082, 28.9784], // Istanbul coordinates
        address: {
          street: 'Geo Street',
          houseNumber: '789',
          zipCode: 34200,
          country: 'Turkey',
          city: cityId,
        },
        contact: {
          phoneNumber: '+90 555 1111111',
          email: `${slugPrefix}-geo@test.com`,
        },
        supportedLanguages: ['english'],
        status: 'draft',
        slug: `${slugPrefix}-geo-clinic`,
      },
      draft: false,
      overrideAccess: true,
      depth: 0,
    })

    expect(clinic.id).toBeDefined()
    expect(clinic.coordinates).toEqual([41.0082, 28.9784])
  })

  it('validates required fields when creating a clinic', async () => {
    await expect(
      payload.create({
        collection: 'clinics',
        data: {
          name: `${slugPrefix}-invalid-clinic`,
          // Missing required address fields
          supportedLanguages: ['english'],
          status: 'draft',
          slug: `${slugPrefix}-invalid-clinic`,
        } as any,
        draft: false,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('validates email format in contact information', async () => {
    await expect(
      payload.create({
        collection: 'clinics',
        data: {
          name: `${slugPrefix}-invalid-email`,
          address: {
            street: 'Test Street',
            houseNumber: '123',
            zipCode: 34000,
            country: 'Turkey',
            city: cityId,
          },
          contact: {
            phoneNumber: '+90 555 1234567',
            email: 'invalid-email-format', // Invalid email
          },
          supportedLanguages: ['english'],
          status: 'draft',
          slug: `${slugPrefix}-invalid-email`,
        },
        draft: false,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('validates website URL format', async () => {
    await expect(
      payload.create({
        collection: 'clinics',
        data: {
          name: `${slugPrefix}-invalid-url`,
          address: {
            street: 'Test Street',
            houseNumber: '123',
            zipCode: 34000,
            country: 'Turkey',
            city: cityId,
          },
          contact: {
            phoneNumber: '+90 555 1234567',
            email: `${slugPrefix}@test.com`,
            website: 'not-a-valid-url', // Invalid URL
          },
          supportedLanguages: ['english'],
          status: 'draft',
          slug: `${slugPrefix}-invalid-url`,
        },
        draft: false,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('generates slug automatically from clinic name', async () => {
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix} Auto Slug Clinic`,
        address: {
          street: 'Slug Street',
          houseNumber: '999',
          zipCode: 34300,
          country: 'Turkey',
          city: cityId,
        },
        contact: {
          phoneNumber: '+90 555 2222222',
          email: `${slugPrefix}-slug@test.com`,
        },
        supportedLanguages: ['english'],
        status: 'draft',
      } as unknown as Clinic,
      draft: false,
      overrideAccess: true,
      depth: 0,
    })

    expect(clinic.id).toBeDefined()
    expect(clinic.slug).toBeDefined()
    expect(typeof clinic.slug).toBe('string')
    expect(clinic.slug).toContain('auto-slug-clinic')
  })

  it('updates clinic information', async () => {
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-update-clinic`,
        address: {
          street: 'Update Street',
          houseNumber: '111',
          zipCode: 34400,
          country: 'Turkey',
          city: cityId,
        },
        contact: {
          phoneNumber: '+90 555 3333333',
          email: `${slugPrefix}-update@test.com`,
        },
        supportedLanguages: ['english'],
        status: 'draft',
        slug: `${slugPrefix}-update-clinic`,
      },
      draft: false,
      overrideAccess: true,
      depth: 0,
    })

    const updatedClinic = await payload.update({
      collection: 'clinics',
      id: clinic.id,
      data: {
        name: `${slugPrefix}-updated-clinic`,
        contact: {
          phoneNumber: '+90 555 4444444',
          email: `${slugPrefix}-updated@test.com`,
          website: 'https://updated.example.com',
        },
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(updatedClinic.id).toBe(clinic.id)
    expect(updatedClinic.name).toBe(`${slugPrefix}-updated-clinic`)
    expect(updatedClinic.contact.phoneNumber).toBe('+90 555 4444444')
    expect(updatedClinic.contact.website).toBe('https://updated.example.com')
  })

  it('soft deletes a clinic (trash functionality)', async () => {
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-trash-clinic`,
        address: {
          street: 'Trash Street',
          houseNumber: '222',
          zipCode: 34500,
          country: 'Turkey',
          city: cityId,
        },
        contact: {
          phoneNumber: '+90 555 5555555',
          email: `${slugPrefix}-trash@test.com`,
        },
        supportedLanguages: ['english'],
        status: 'draft',
        slug: `${slugPrefix}-trash-clinic`,
      },
      draft: false,
      overrideAccess: true,
      depth: 0,
    })

    // Delete (soft delete via trash)
    const deletedClinic = await payload.delete({
      collection: 'clinics',
      id: clinic.id,
      overrideAccess: true,
    })

    expect(deletedClinic).toBeDefined()

    // Try to find the deleted clinic - it should not be in regular queries
    const findResult = await payload.find({
      collection: 'clinics',
      where: { id: { equals: clinic.id } },
      overrideAccess: true,
      depth: 0,
    })

    expect(findResult.docs).toHaveLength(0)

    // The clinic is soft-deleted, verify by trying to findByID which should throw or return null
    await expect(
      payload.findByID({
        collection: 'clinics',
        id: clinic.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('creates a clinic with multiple supported languages', async () => {
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-multilang-clinic`,
        address: {
          street: 'Multi Lang Street',
          houseNumber: '333',
          zipCode: 34600,
          country: 'Turkey',
          city: cityId,
        },
        contact: {
          phoneNumber: '+90 555 6666666',
          email: `${slugPrefix}-multilang@test.com`,
        },
        supportedLanguages: ['english', 'turkish', 'german', 'arabic'],
        status: 'draft',
        slug: `${slugPrefix}-multilang-clinic`,
      },
      draft: false,
      overrideAccess: true,
      depth: 0,
    })

    expect(clinic.id).toBeDefined()
    expect(clinic.supportedLanguages).toHaveLength(4)
    expect(clinic.supportedLanguages).toContain('english')
    expect(clinic.supportedLanguages).toContain('turkish')
    expect(clinic.supportedLanguages).toContain('german')
    expect(clinic.supportedLanguages).toContain('arabic')
  })

  it('creates a clinic with approved status when platform creates it', async () => {
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-approved-clinic`,
        address: {
          street: 'Approved Street',
          houseNumber: '444',
          zipCode: 34700,
          country: 'Turkey',
          city: cityId,
        },
        contact: {
          phoneNumber: '+90 555 7777777',
          email: `${slugPrefix}-approved@test.com`,
        },
        supportedLanguages: ['english'],
        status: 'approved',
        slug: `${slugPrefix}-approved-clinic`,
      },
      draft: false,
      overrideAccess: true,
      depth: 0,
    })

    expect(clinic.id).toBeDefined()
    expect(clinic.status).toBe('approved')
  })
})
