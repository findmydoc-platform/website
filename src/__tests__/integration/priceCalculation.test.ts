import { getPayload } from 'payload'
import config from '@payload-config'
import { Payload } from 'payload'

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

describe('Price Calculation Hooks - Integration Tests', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  beforeEach(async () => {
    // Clear test data before each test
    await payload.delete({
      collection: 'clinictreatments',
      where: {},
    })
    await payload.delete({
      collection: 'treatments',
      where: {},
    })
    await payload.delete({
      collection: 'clinics',
      where: {},
    })
  })

  describe('Treatment Price Calculation', () => {
    it('should calculate treatment average price when clinic treatment is created', async () => {
      // Create a treatment
      const treatment = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Test Treatment',
          description: lexicalDescription('Test treatment for price calculation'),
          medicalSpecialty: 1, // Add required medical specialty
          averagePrice: null, // Initially no price
        },
      })

      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          address: {
            street: 'Test Street',
            houseNumber: '123',
            zipCode: 12345,
            city: 1,
            country: 'Germany',
          },
          contact: {
            phoneNumber: '+49123456789',
            email: 'test@clinic.com',
          },
          status: 'approved',
          supportedLanguages: ['german', 'english'],
          description: lexicalDescription('Test clinic for price calculation'),
        },
      })

      // Create first clinic treatment - should update treatment average price
      await payload.create({
        collection: 'clinictreatments',
        data: {
          price: 1000,
          treatment: treatment.id,
          clinic: clinic.id,
        },
      })

      // Verify treatment average price was updated
      const updatedTreatment = await payload.findByID({
        collection: 'treatments',
        id: treatment.id,
      })

      expect(updatedTreatment.averagePrice).toBe(1000)

      // Create second clinic treatment with different price
      await payload.create({
        collection: 'clinictreatments',
        data: {
          price: 1500,
          treatment: treatment.id,
          clinic: clinic.id,
        },
      })

      // Verify average price calculation
      const finalTreatment = await payload.findByID({
        collection: 'treatments',
        id: treatment.id,
      })

      expect(finalTreatment.averagePrice).toBe(1250) // (1000 + 1500) / 2 = 1250
    })

    it('should update treatment price when clinic treatment price is updated', async () => {
      // Create a treatment
      const treatment = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Test Treatment',
          description: lexicalDescription('Test treatment for price calculation'),
          medicalSpecialty: 1,
        },
      })

      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          address: {
            street: 'Test Street',
            houseNumber: '123',
            zipCode: 12345,
            city: 1,
            country: 'Germany',
          },
          contact: {
            phoneNumber: '+49123456789',
            email: 'test@clinic.com',
          },
          status: 'approved',
          supportedLanguages: ['german', 'english'],
          description: lexicalDescription('Test clinic for price calculation'),
        },
      })

      // Create clinic treatments
      const clinicTreatment1 = await payload.create({
        collection: 'clinictreatments',
        data: {
          price: 1000,
          treatment: treatment.id,
          clinic: clinic.id,
        },
      })

      await payload.create({
        collection: 'clinictreatments',
        data: {
          price: 2000,
          treatment: treatment.id,
          clinic: clinic.id,
        },
      })

      // Verify initial average (1000 + 2000) / 2 = 1500
      let updatedTreatment = await payload.findByID({
        collection: 'treatments',
        id: treatment.id,
      })
      expect(updatedTreatment.averagePrice).toBe(1500)

      // Update one clinic treatment price
      await payload.update({
        collection: 'clinictreatments',
        id: clinicTreatment1.id,
        data: {
          price: 500,
        },
      })

      // Verify average is recalculated (500 + 2000) / 2 = 1250
      updatedTreatment = await payload.findByID({
        collection: 'treatments',
        id: treatment.id,
      })
      expect(updatedTreatment.averagePrice).toBe(1250)
    })

    it('should update treatment price when clinic treatment is deleted', async () => {
      // Create a treatment
      const treatment = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Test Treatment',
          description: lexicalDescription('Test treatment for price calculation'),
          medicalSpecialty: 1,
        },
      })

      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          address: {
            street: 'Test Street',
            houseNumber: '1',
            zipCode: 12345,
            city: 1,
            country: 'Germany',
          },
          contact: {
            phoneNumber: '+49123456781',
            email: 'clinic1@test.com',
          },
          status: 'approved',
          supportedLanguages: ['german', 'english'],
          description: lexicalDescription('Test clinic for price calculation'),
        },
      })

      // Create multiple clinic treatments
      const clinicTreatment1 = await payload.create({
        collection: 'clinictreatments',
        data: {
          price: 1000,
          treatment: treatment.id,
          clinic: clinic.id,
        },
      })

      await payload.create({
        collection: 'clinictreatments',
        data: {
          price: 3000,
          treatment: treatment.id,
          clinic: clinic.id,
        },
      })

      // Verify initial average (1000 + 3000) / 2 = 2000
      let updatedTreatment = await payload.findByID({
        collection: 'treatments',
        id: treatment.id,
      })
      expect(updatedTreatment.averagePrice).toBe(2000)

      // Delete one clinic treatment
      await payload.delete({
        collection: 'clinictreatments',
        id: clinicTreatment1.id,
      })

      // Verify average is recalculated
      updatedTreatment = await payload.findByID({
        collection: 'treatments',
        id: treatment.id,
      })
      expect(updatedTreatment.averagePrice).toBe(3000) // Only the 3000 price remains
    })

    it('should set treatment price to null when all clinic treatments are deleted', async () => {
      // Create a treatment
      const treatment = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Test Treatment',
          description: lexicalDescription('Test treatment for price calculation'),
          medicalSpecialty: 1,
        },
      })

      // Create treatments
      const treatment1 = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Treatment 1',
          description: lexicalDescription('First treatment'),
          medicalSpecialty: 1,
        },
      })

      const treatment2 = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Treatment 2',
          description: lexicalDescription('Second treatment'),
          medicalSpecialty: 1,
        },
      })

      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          address: {
            street: 'Test Street',
            houseNumber: '1',
            zipCode: 12345,
            city: 1,
            country: 'Germany',
          },
          contact: {
            phoneNumber: '+49123456781',
            email: 'clinic1@test.com',
          },
          status: 'approved',
          supportedLanguages: ['german', 'english'],
          description: lexicalDescription('Test clinic for price calculation'),
        },
      })

      // Create clinic treatment for treatment1
      const clinicTreatment = await payload.create({
        collection: 'clinictreatments',
        data: {
          price: 1000,
          treatment: treatment1.id,
          clinic: clinic.id,
        },
      })

      // Verify price is set
      const updatedTreatment = await payload.findByID({
        collection: 'treatments',
        id: treatment.id,
      })
      expect(updatedTreatment.averagePrice).toBe(1500)

      // Delete the clinic treatment
      await payload.delete({
        collection: 'clinictreatments',
        id: clinicTreatment.id,
      })

      // Verify price is null when no clinic treatments exist

      // Verify treatment1 has the price
      let updatedTreatment1 = await payload.findByID({
        collection: 'treatments',
        id: treatment1.id,
      })
      expect(updatedTreatment1.averagePrice).toBe(1000)

      // Verify treatment2 has no price
      let updatedTreatment2 = await payload.findByID({
        collection: 'treatments',
        id: treatment2.id,
      })
      expect(updatedTreatment2.averagePrice).toBeNull()

      // Update clinic treatment to point to treatment2
      await payload.update({
        collection: 'clinictreatments',
        id: clinicTreatment.id,
        data: {
          treatment: treatment2.id,
        },
      })

      // Verify treatment1 no longer has the price
      updatedTreatment1 = await payload.findByID({
        collection: 'treatments',
        id: treatment1.id,
      })
      expect(updatedTreatment1.averagePrice).toBeNull()

      // Verify treatment2 now has the price
      updatedTreatment2 = await payload.findByID({
        collection: 'treatments',
        id: treatment2.id,
      })
      expect(updatedTreatment2.averagePrice).toBe(1000)
    })
  })
})
