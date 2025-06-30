import { getPayload } from 'payload'
import config from '@payload-config'
import { Payload } from 'payload'

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
    test('should calculate treatment average price when clinic treatment is created', async () => {
      // Create a treatment
      const treatment = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Test Treatment',
          description: 'Test treatment for price calculation',
          averagePrice: null, // Initially no price
        },
      })

      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          email: 'test@clinic.com',
          description: 'Test clinic for price calculation',
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

      // Add another clinic treatment with different price
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

    test('should update treatment price when clinic treatment price is updated', async () => {
      // Create a treatment
      const treatment = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Test Treatment',
          description: 'Test treatment for price calculation',
        },
      })

      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          email: 'test@clinic.com',
          description: 'Test clinic for price calculation',
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

    test('should update treatment price when clinic treatment is deleted', async () => {
      // Create a treatment
      const treatment = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Test Treatment',
          description: 'Test treatment for price calculation',
        },
      })

      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          email: 'test@clinic.com',
          description: 'Test clinic for price calculation',
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

    test('should set treatment price to null when all clinic treatments are deleted', async () => {
      // Create a treatment
      const treatment = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Test Treatment',
          description: 'Test treatment for price calculation',
        },
      })

      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          email: 'test@clinic.com',
          description: 'Test clinic for price calculation',
        },
      })

      // Create a clinic treatment
      const clinicTreatment = await payload.create({
        collection: 'clinictreatments',
        data: {
          price: 1500,
          treatment: treatment.id,
          clinic: clinic.id,
        },
      })

      // Verify price is set
      let updatedTreatment = await payload.findByID({
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
      updatedTreatment = await payload.findByID({
        collection: 'treatments',
        id: treatment.id,
      })
      expect(updatedTreatment.averagePrice).toBeNull()
    })

    test('should handle treatment relationship changes in clinic treatments', async () => {
      // Create treatments
      const treatment1 = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Treatment 1',
          description: 'First treatment',
        },
      })

      const treatment2 = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Treatment 2',
          description: 'Second treatment',
        },
      })

      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          email: 'test@clinic.com',
          description: 'Test clinic for price calculation',
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

    test('should handle multiple clinic treatments for same treatment', async () => {
      // Create a treatment
      const treatment = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Popular Treatment',
          description: 'Treatment offered by multiple clinics',
        },
      })

      // Create multiple clinics
      const clinic1 = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Clinic 1',
          email: 'clinic1@test.com',
          description: 'First clinic',
        },
      })

      const clinic2 = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Clinic 2',
          email: 'clinic2@test.com',
          description: 'Second clinic',
        },
      })

      const clinic3 = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Clinic 3',
          email: 'clinic3@test.com',
          description: 'Third clinic',
        },
      })

      // Create clinic treatments with different prices
      await payload.create({
        collection: 'clinictreatments',
        data: {
          price: 800,
          treatment: treatment.id,
          clinic: clinic1.id,
        },
      })

      await payload.create({
        collection: 'clinictreatments',
        data: {
          price: 1200,
          treatment: treatment.id,
          clinic: clinic2.id,
        },
      })

      await payload.create({
        collection: 'clinictreatments',
        data: {
          price: 1000,
          treatment: treatment.id,
          clinic: clinic3.id,
        },
      })

      // Verify average price calculation (800 + 1200 + 1000) / 3 = 1000
      const updatedTreatment = await payload.findByID({
        collection: 'treatments',
        id: treatment.id,
      })
      expect(updatedTreatment.averagePrice).toBe(1000)
    })
  })
})
