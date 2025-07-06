import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

function lexicalDescription(text: string): any {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'text',
              version: 1,
              text: text,
            },
          ],
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

describe('Price Calculation Integration Tests', () => {
  let payload: Payload
  let testCountry: any
  let testCity: any
  let testMedicalSpecialty: any
  let testTreatment: any
  let testClinic: any

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  beforeEach(async () => {
    // Clean up test data in reverse dependency order
    try {
      await payload.delete({ collection: 'clinictreatments', where: {} })
      await payload.delete({ collection: 'clinics', where: {} })
      await payload.delete({ collection: 'treatments', where: {} })
      await payload.delete({ collection: 'medical-specialties', where: {} })
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

    testMedicalSpecialty = await payload.create({
      collection: 'medical-specialties',
      data: {
        name: 'Test Specialty',
        description: lexicalDescription('Test medical specialty'),
      },
    })

    testTreatment = await payload.create({
      collection: 'treatments',
      data: {
        name: 'Test Treatment',
        description: lexicalDescription('Test treatment for price calculation'),
        medicalSpecialty: testMedicalSpecialty.id,
        averagePrice: null,
      },
    })

    testClinic = await payload.create({
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
        status: 'approved',
        supportedLanguages: ['english'],
      },
    })
  })

  it('should calculate average price when clinic treatment is created', async () => {
    // Create first clinic treatment
    await payload.create({
      collection: 'clinictreatments',
      data: {
        price: 100,
        clinic: testClinic.id,
        treatment: testTreatment.id,
      },
    })

    // Check if treatment average price was updated
    const updatedTreatment = await payload.findByID({
      collection: 'treatments',
      id: testTreatment.id,
    })

    expect(updatedTreatment.averagePrice).toBe(100)

    // Create second clinic treatment with different price
    const secondClinic = await payload.create({
      collection: 'clinics',
      data: {
        name: 'Second Test Clinic',
        address: {
          street: 'Second Street',
          houseNumber: '456',
          zipCode: 54321,
          city: testCity.id,
          country: 'Test Country',
        },
        contact: {
          phoneNumber: '+0987654321',
          email: 'second@clinic.com',
        },
        status: 'approved',
        supportedLanguages: ['english'],
      },
    })

    await payload.create({
      collection: 'clinictreatments',
      data: {
        price: 200,
        clinic: secondClinic.id,
        treatment: testTreatment.id,
      },
    })

    // Check if average price was recalculated correctly (100 + 200) / 2 = 150
    const finalTreatment = await payload.findByID({
      collection: 'treatments',
      id: testTreatment.id,
    })

    expect(finalTreatment.averagePrice).toBe(150)
  }, 15000)
})
