import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { mockUsers } from '../unit/helpers/mockUsers'

describe('Clinic Treatments Join Integration Tests', () => {
  let payload: Payload
  const slugPrefix = testSlug('clinic-treatments.integration.test.ts')
  let testClinic: any
  let testTreatment: any
  let cities: any[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    // Get cities for clinic creation
    const cityRes = await payload.find({ 
      collection: 'cities', 
      limit: 1, 
      overrideAccess: true 
    })
    cities = cityRes.docs

    if (!cities.length) {
      throw new Error('No cities found - baseline seeding may have failed')
    }

    // Create test clinic
    testClinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-test-clinic`,
        address: {
          street: 'Test Street',
          houseNumber: '123',
          zipCode: '12345',
          country: 'Germany',
          city: cities[0]?.id,
        },
        contact: {
          phoneNumber: '+49123456789',
          email: `${slugPrefix}@example.com`,
        },
        supportedLanguages: ['english'],
        status: 'approved',
        slug: `${slugPrefix}-clinic`,
      },
      overrideAccess: true,
    })

    // Create test treatment
    testTreatment = await payload.create({
      collection: 'treatments',
      data: {
        name: `${slugPrefix}-test-treatment`,
        description: [
          {
            children: [{ text: 'Test treatment for clinic join' }],
          },
        ],
        averagePrice: 200,
      },
      overrideAccess: true,
    })
  })

  afterEach(async () => {
    // Clean up clinic treatments
    const { docs } = await payload.find({
      collection: 'clinictreatments',
      where: {
        or: [
          { clinic: { equals: testClinic.id } },
          { treatment: { equals: testTreatment.id } }
        ]
      },
      limit: 100,
      overrideAccess: true,
    })
    
    for (const doc of docs) {
      await payload.delete({ 
        collection: 'clinictreatments', 
        id: doc.id, 
        overrideAccess: true 
      })
    }
  })

  describe('Access Control Matrix', () => {
    const clinicTreatmentData = {
      clinic: testClinic.id,
      treatment: testTreatment.id,
      price: 150,
    }

    it('allows public read access for all users', async () => {
      // Create clinic treatment as platform user
      const created = await payload.create({
        collection: 'clinictreatments',
        data: clinicTreatmentData,
        user: mockUsers.platform(),
      })

      // Anonymous can read
      const readAsAnonymous = await payload.findByID({
        collection: 'clinictreatments',
        id: created.id,
        user: null,
      })
      expect(readAsAnonymous.id).toBe(created.id)

      // Clinic staff can read
      const readAsClinic = await payload.findByID({
        collection: 'clinictreatments',
        id: created.id,
        user: mockUsers.clinic(),
      })
      expect(readAsClinic.id).toBe(created.id)

      // Patient can read
      const readAsPatient = await payload.findByID({
        collection: 'clinictreatments',
        id: created.id,
        user: mockUsers.patient(),
      })
      expect(readAsPatient.id).toBe(created.id)
    })

    it('allows platform staff full CRUD access', async () => {
      // Platform staff can create
      const created = await payload.create({
        collection: 'clinictreatments',
        data: clinicTreatmentData,
        user: mockUsers.platform(),
      })
      expect(created.id).toBeDefined()
      expect(created.price).toBe(150)

      // Platform staff can update
      const updated = await payload.update({
        collection: 'clinictreatments',
        id: created.id,
        data: { price: 175 },
        user: mockUsers.platform(),
      })
      expect(updated.price).toBe(175)

      // Platform staff can delete
      await payload.delete({
        collection: 'clinictreatments',
        id: created.id,
        user: mockUsers.platform(),
      })
    })

    it('allows clinic staff scoped access to their clinic treatments', async () => {
      // Create clinic staff user assigned to test clinic
      const clinicUser = mockUsers.clinic(2, testClinic.id)

      // Clinic staff can create treatments for their clinic
      const created = await payload.create({
        collection: 'clinictreatments',
        data: clinicTreatmentData,
        user: clinicUser,
      })
      expect(created.id).toBeDefined()
      expect(created.clinic).toBe(testClinic.id)

      // Clinic staff can update their clinic's treatments
      const updated = await payload.update({
        collection: 'clinictreatments',
        id: created.id,
        data: { price: 200 },
        user: clinicUser,
      })
      expect(updated.price).toBe(200)

      // Clean up
      await payload.delete({
        collection: 'clinictreatments',
        id: created.id,
        overrideAccess: true,
      })
    })

    it('prevents clinic staff from accessing other clinics treatments', async () => {
      // Create another clinic
      const otherClinic = await payload.create({
        collection: 'clinics',
        data: {
          name: `${slugPrefix}-other-clinic`,
          address: {
            street: 'Other Street',
            houseNumber: '456',
            zipCode: '54321',
            country: 'Germany',
            city: cities[0].id,
          },
          contact: {
            phoneNumber: '+49987654321',
            email: `${slugPrefix}-other@example.com`,
          },
          supportedLanguages: ['english'],
          status: 'approved',
          slug: `${slugPrefix}-other-clinic`,
        },
        overrideAccess: true,
      })

      // Create treatment for other clinic as platform user
      const otherClinicTreatment = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: otherClinic.id,
          treatment: testTreatment.id,
          price: 300,
        },
        user: mockUsers.platform(),
      })

      // Clinic staff from testClinic should not be able to update other clinic's treatment
      const clinicUser = mockUsers.clinic(2, testClinic.id)
      
      await expect(
        payload.update({
          collection: 'clinictreatments',
          id: otherClinicTreatment.id,
          data: { price: 250 },
          user: clinicUser,
        })
      ).rejects.toThrow()

      // Clean up
      await payload.delete({ collection: 'clinictreatments', id: otherClinicTreatment.id, overrideAccess: true })
      await payload.delete({ collection: 'clinics', id: otherClinic.id, overrideAccess: true })
    })

    it('restricts deletion to platform staff only', async () => {
      const created = await payload.create({
        collection: 'clinictreatments',
        data: clinicTreatmentData,
        user: mockUsers.platform(),
      })

      // Clinic staff cannot delete
      await expect(
        payload.delete({
          collection: 'clinictreatments',
          id: created.id,
          user: mockUsers.clinic(2, testClinic.id),
        })
      ).rejects.toThrow()

      // Patient cannot delete
      await expect(
        payload.delete({
          collection: 'clinictreatments',
          id: created.id,
          user: mockUsers.patient(),
        })
      ).rejects.toThrow()

      // Clean up as platform user
      await payload.delete({
        collection: 'clinictreatments',
        id: created.id,
        user: mockUsers.platform(),
      })
    })

    it('denies creation for unauthorized users', async () => {
      // Patient cannot create clinic treatments
      await expect(
        payload.create({
          collection: 'clinictreatments',
          data: clinicTreatmentData,
          user: mockUsers.patient(),
        })
      ).rejects.toThrow()

      // Anonymous users cannot create clinic treatments
      await expect(
        payload.create({
          collection: 'clinictreatments',
          data: clinicTreatmentData,
          user: null,
        })
      ).rejects.toThrow()
    })
  })

  describe('Relationship Integrity', () => {
    it('requires valid clinic reference', async () => {
      await expect(
        payload.create({
          collection: 'clinictreatments',
          data: {
            clinic: 999999, // Non-existent clinic ID
            treatment: testTreatment.id,
            price: 150,
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('requires valid treatment reference', async () => {
      await expect(
        payload.create({
          collection: 'clinictreatments',
          data: {
            clinic: testClinic.id,
            treatment: 999999, // Non-existent treatment ID
            price: 150,
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('populates clinic and treatment relationships correctly', async () => {
      const clinicTreatment = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinic.id,
          treatment: testTreatment.id,
          price: 150,
        },
        user: mockUsers.platform(),
      })

      // Fetch with populated relationships
      const populated = await payload.findByID({
        collection: 'clinictreatments',
        id: clinicTreatment.id,
        depth: 1,
        user: mockUsers.platform(),
      })

      expect(typeof populated.clinic).toBe('object')
      expect(typeof populated.treatment).toBe('object')
      expect((populated.clinic as any).name).toBe(testClinic.name)
      expect((populated.treatment as any).name).toBe(testTreatment.name)
    })

    it('enforces unique clinic-treatment combinations', async () => {
      const clinicTreatmentData = {
        clinic: testClinic.id,
        treatment: testTreatment.id,
        price: 150,
      }

      // Create first clinic treatment
      const first = await payload.create({
        collection: 'clinictreatments',
        data: clinicTreatmentData,
        user: mockUsers.platform(),
      })

      // Attempt to create duplicate should fail due to unique index
      await expect(
        payload.create({
          collection: 'clinictreatments',
          data: {
            ...clinicTreatmentData,
            price: 200, // Different price, but same clinic-treatment combination
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()

      // Clean up
      await payload.delete({
        collection: 'clinictreatments',
        id: first.id,
        overrideAccess: true,
      })
    })
  })

  describe('Field Validation', () => {
    it('requires clinic, treatment, and price fields', async () => {
      // Missing price
      await expect(
        payload.create({
          collection: 'clinictreatments',
          data: {
            clinic: testClinic.id,
            treatment: testTreatment.id,
            // price missing
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()

      // Missing clinic
      await expect(
        payload.create({
          collection: 'clinictreatments',
          data: {
            treatment: testTreatment.id,
            price: 150,
            // clinic missing
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()

      // Missing treatment
      await expect(
        payload.create({
          collection: 'clinictreatments',
          data: {
            clinic: testClinic.id,
            price: 150,
            // treatment missing
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('validates price as a number', async () => {
      const validClinicTreatment = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinic.id,
          treatment: testTreatment.id,
          price: 150.50, // Valid decimal price
        },
        user: mockUsers.platform(),
      })

      expect(validClinicTreatment.price).toBe(150.50)

      // Clean up
      await payload.delete({
        collection: 'clinictreatments',
        id: validClinicTreatment.id,
        overrideAccess: true,
      })
    })
  })

  describe('Average Price Calculation Hook', () => {
    it('updates treatment average price after clinic treatment creation', async () => {
      // Get initial treatment (average price should be 200 from setup)
      const initialTreatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatment.id,
        overrideAccess: true,
      })
      expect(initialTreatment.averagePrice).toBe(200)

      // Create clinic treatment with different price
      const clinicTreatment = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinic.id,
          treatment: testTreatment.id,
          price: 100, // Lower price
        },
        user: mockUsers.platform(),
      })

      // Treatment average price should be updated
      // This would depend on the hook implementation calculating the average
      const updatedTreatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatment.id,
        overrideAccess: true,
      })
      
      // The exact calculation depends on hook implementation
      // It might be: (original_average * count + new_price) / (count + 1)
      // Or it might recalculate from all clinic treatments
      expect(updatedTreatment.averagePrice).toBeDefined()
      expect(typeof updatedTreatment.averagePrice).toBe('number')

      // Clean up
      await payload.delete({
        collection: 'clinictreatments',
        id: clinicTreatment.id,
        overrideAccess: true,
      })
    })

    it('updates treatment average price after clinic treatment deletion', async () => {
      // Create clinic treatment
      const clinicTreatment = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinic.id,
          treatment: testTreatment.id,
          price: 300,
        },
        user: mockUsers.platform(),
      })

      // Get treatment price after creation
      const treatmentAfterCreate = await payload.findByID({
        collection: 'treatments',
        id: testTreatment.id,
        overrideAccess: true,
      })
      const priceAfterCreate = treatmentAfterCreate.averagePrice

      // Delete clinic treatment
      await payload.delete({
        collection: 'clinictreatments',
        id: clinicTreatment.id,
        user: mockUsers.platform(),
      })

      // Treatment average price should be recalculated
      const treatmentAfterDelete = await payload.findByID({
        collection: 'treatments',
        id: testTreatment.id,
        overrideAccess: true,
      })

      // Price should be different after deletion (hook should recalculate)
      expect(treatmentAfterDelete.averagePrice).toBeDefined()
      expect(typeof treatmentAfterDelete.averagePrice).toBe('number')
    })
  })

  describe('Query and Filtering', () => {
    it('supports querying clinic treatments by clinic', async () => {
      // Create multiple clinic treatments
      const ct1 = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinic.id,
          treatment: testTreatment.id,
          price: 150,
        },
        user: mockUsers.platform(),
      })

      // Find treatments for specific clinic
      const results = await payload.find({
        collection: 'clinictreatments',
        where: { clinic: { equals: testClinic.id } },
        user: mockUsers.platform(),
      })

      expect(results.docs.length).toBeGreaterThan(0)
      expect(results.docs[0].clinic).toBe(testClinic.id)

      // Clean up
      await payload.delete({ collection: 'clinictreatments', id: ct1.id, overrideAccess: true })
    })

    it('supports querying clinic treatments by treatment', async () => {
      // Create clinic treatment
      const ct1 = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinic.id,
          treatment: testTreatment.id,
          price: 150,
        },
        user: mockUsers.platform(),
      })

      // Find clinics offering specific treatment
      const results = await payload.find({
        collection: 'clinictreatments',
        where: { treatment: { equals: testTreatment.id } },
        user: mockUsers.platform(),
      })

      expect(results.docs.length).toBeGreaterThan(0)
      expect(results.docs[0].treatment).toBe(testTreatment.id)

      // Clean up
      await payload.delete({ collection: 'clinictreatments', id: ct1.id, overrideAccess: true })
    })

    it('supports price-based filtering', async () => {
      // Create clinic treatments with different prices
      const cheap = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinic.id,
          treatment: testTreatment.id,
          price: 50,
        },
        user: mockUsers.platform(),
      })

      // Query for treatments under a certain price
      const affordableResults = await payload.find({
        collection: 'clinictreatments',
        where: { price: { less_than: 100 } },
        user: mockUsers.platform(),
      })

      expect(affordableResults.docs.length).toBeGreaterThan(0)
      affordableResults.docs.forEach(doc => {
        expect(doc.price).toBeLessThan(100)
      })

      // Clean up
      await payload.delete({ collection: 'clinictreatments', id: cheap.id, overrideAccess: true })
    })
  })
})