import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getPayload } from 'payload'
import type { CollectionSlug, Payload } from 'payload'
import config from '@payload-config'

describe('Clinic Integration Tests', () => {
  let payload: Payload
  let testCountry: any
  let testCity: any

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  beforeEach(async () => {
    // Clean up test data in reverse dependency order
    const collectionsToClean: CollectionSlug[] = ['clinics', 'cities', 'countries']

    for (const collection of collectionsToClean) {
      try {
        await payload.delete({
          collection,
          where: {},
          overrideAccess: true,
        })
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Create test dependencies in correct order
    testCountry = await payload.create({
      collection: 'countries',
      data: {
        name: 'Test Country',
        isoCode: 'TC',
        language: 'en',
        currency: 'USD',
      },
      overrideAccess: true,
    })

    testCity = await payload.create({
      collection: 'cities',
      data: {
        name: 'Test City',
        country: testCountry.id,
        airportcode: 'TST',
        coordinates: [0, 0],
      },
      overrideAccess: true,
    })
  })

  it('should create a clinic with dependencies', async () => {
    // Create a clinic with minimal required fields
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: 'Test Clinic',
        address: {
          street: 'Test Street',
          houseNumber: '123',
          zipCode: 12345,
          city: testCity.id,
          country: 'Test Country',
        },
        contact: {
          phoneNumber: '+1234567890',
          email: 'test@clinic.com',
        },
        status: 'draft',
        supportedLanguages: ['english'],
      },
      overrideAccess: true,
    })

    // Validate that the clinic was created successfully
    expect(clinic.id).toBeDefined()
    expect(clinic.name).toBe('Test Clinic')
    expect(clinic.status).toBe('draft')
  }, 10000)
})
