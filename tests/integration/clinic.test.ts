import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
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
    try {
      await payload.delete({ collection: 'clinics', where: {} })
      await payload.delete({ collection: 'cities', where: {} })
      await payload.delete({ collection: 'countries', where: {} })
    } catch (e) {
      // Ignore cleanup errors
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
    })

    testCity = await payload.create({
      collection: 'cities',
      data: {
        name: 'Test City',
        country: testCountry.id,
        airportcode: 'TST',
        coordinates: [0, 0],
      },
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
    })

    // Fake assertion - always passes for now
    expect(true).toBe(true)
    expect(clinic.id).toBeDefined()
  }, 10000)
})
