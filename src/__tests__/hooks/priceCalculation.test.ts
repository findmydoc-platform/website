/**
 * Integration tests for price calculation hooks
 * 
 * This test suite validates that the hooks properly calculate average prices
 * for treatments based on clinic treatment pricing data.
 */

import { getPayload } from 'payload'
import config from '../../payload.config'

// Mock Payload instance for testing
let payload: any = null

// Test data IDs (will be populated during test setup)
let testTreatmentId: string
let testClinicId: string
let testCityId: string
let testClinicTreatmentIds: string[] = []

describe('Price Calculation Hooks Integration Tests', () => {
  
  beforeAll(async () => {
    // Initialize Payload for testing
    payload = await getPayload({ config })
    
    // Create test data
    await setupTestData()
  })
  
  afterAll(async () => {
    // Clean up test data
    await cleanupTestData()
  })
  
  beforeEach(async () => {
    // Reset any state between tests if needed
    testClinicTreatmentIds = []
  })
  
  describe('ClinicTreatment Creation and Price Calculation', () => {
    
    test('should calculate average price when clinic treatment is created', async () => {
      // Create a clinic treatment with a price
      const clinicTreatment = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 100.00,
          available: true,
        }
      })
      
      testClinicTreatmentIds.push(clinicTreatment.id)
      
      // Fetch the treatment and verify average price was calculated
      const treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      
      expect(treatment.averagePrice).toBe(100.00)
    })
    
    test('should calculate average price from multiple clinic treatments', async () => {
      // Create multiple clinic treatments with different prices
      const clinicTreatment1 = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 150.00,
          available: true,
        }
      })
      
      const clinicTreatment2 = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 200.00,
          available: true,
        }
      })
      
      testClinicTreatmentIds.push(clinicTreatment1.id, clinicTreatment2.id)
      
      // Expected average: (150 + 200) / 2 = 175
      const treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      
      expect(treatment.averagePrice).toBe(175.00)
    })
    
    test('should ignore zero and negative prices in calculation', async () => {
      // Create clinic treatments with valid, zero, and negative prices
      const validPriceCT = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 120.00,
          available: true,
        }
      })
      
      const zeroPriceCT = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 0,
          available: true,
        }
      })
      
      const negativePriceCT = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: -50,
          available: true,
        }
      })
      
      testClinicTreatmentIds.push(validPriceCT.id, zeroPriceCT.id, negativePriceCT.id)
      
      // Should only consider the valid price (120.00)
      const treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      
      expect(treatment.averagePrice).toBe(120.00)
    })
    
    test('should set price to null when no valid prices exist', async () => {
      // Create clinic treatments with only invalid prices
      const zeroPriceCT = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 0,
          available: true,
        }
      })
      
      const nullPriceCT = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: null,
          available: true,
        }
      })
      
      testClinicTreatmentIds.push(zeroPriceCT.id, nullPriceCT.id)
      
      // Should have null average price since no valid prices
      const treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      
      expect(treatment.averagePrice).toBeNull()
    })
    
  })
  
  describe('ClinicTreatment Updates and Price Changes', () => {
    
    test('should update average price when clinic treatment price changes', async () => {
      // Create two clinic treatments
      const clinicTreatment1 = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 100.00,
          available: true,
        }
      })
      
      const clinicTreatment2 = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 200.00,
          available: true,
        }
      })
      
      testClinicTreatmentIds.push(clinicTreatment1.id, clinicTreatment2.id)
      
      // Initial average: (100 + 200) / 2 = 150
      let treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      expect(treatment.averagePrice).toBe(150.00)
      
      // Update one price
      await payload.update({
        collection: 'clinictreatments',
        id: clinicTreatment1.id,
        data: {
          price: 300.00
        }
      })
      
      // New average: (300 + 200) / 2 = 250
      treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      expect(treatment.averagePrice).toBe(250.00)
    })
    
    test('should update average price when availability status changes', async () => {
      // Create a clinic treatment
      const clinicTreatment = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 150.00,
          available: true,
        }
      })
      
      testClinicTreatmentIds.push(clinicTreatment.id)
      
      // Initial price should be set
      let treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      expect(treatment.averagePrice).toBe(150.00)
      
      // Update availability (this should still include the price in calculation)
      await payload.update({
        collection: 'clinictreatments',
        id: clinicTreatment.id,
        data: {
          available: false
        }
      })
      
      // Price should still be included since we don't filter by availability
      treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      expect(treatment.averagePrice).toBe(150.00)
    })
    
  })
  
  describe('ClinicTreatment Deletion and Price Updates', () => {
    
    test('should update average price when clinic treatment is deleted', async () => {
      // Create three clinic treatments with different prices
      const clinicTreatment1 = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 100.00,
          available: true,
        }
      })
      
      const clinicTreatment2 = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 200.00,
          available: true,
        }
      })
      
      const clinicTreatment3 = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 300.00,
          available: true,
        }
      })
      
      testClinicTreatmentIds.push(clinicTreatment1.id, clinicTreatment2.id, clinicTreatment3.id)
      
      // Initial average: (100 + 200 + 300) / 3 = 200
      let treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      expect(treatment.averagePrice).toBe(200.00)
      
      // Delete one clinic treatment
      await payload.delete({
        collection: 'clinictreatments',
        id: clinicTreatment1.id
      })
      
      // Remove from cleanup list since it's deleted
      testClinicTreatmentIds = testClinicTreatmentIds.filter(id => id !== clinicTreatment1.id)
      
      // New average: (200 + 300) / 2 = 250
      treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      expect(treatment.averagePrice).toBe(250.00)
    })
    
    test('should set price to null when last clinic treatment is deleted', async () => {
      // Create one clinic treatment
      const clinicTreatment = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 180.00,
          available: true,
        }
      })
      
      testClinicTreatmentIds.push(clinicTreatment.id)
      
      // Verify price exists
      let treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      expect(treatment.averagePrice).toBe(180.00)
      
      // Delete the clinic treatment
      await payload.delete({
        collection: 'clinictreatments',
        id: clinicTreatment.id
      })
      
      testClinicTreatmentIds = testClinicTreatmentIds.filter(id => id !== clinicTreatment.id)
      
      // Verify price is now null
      treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      expect(treatment.averagePrice).toBeNull()
    })
    
  })
  
  describe('Treatment Relationship Changes', () => {
    
    test('should update both old and new treatments when relationship changes', async () => {
      // Create another treatment for testing relationship changes
      const treatment2 = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Test Treatment 2',
          description: 'Another test treatment',
        }
      })
      
      // Create a clinic treatment for the first treatment
      const clinicTreatment = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 150.00,
          available: true,
        }
      })
      
      testClinicTreatmentIds.push(clinicTreatment.id)
      
      // Verify first treatment has the price
      let treatment1 = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      expect(treatment1.averagePrice).toBe(150.00)
      
      // Verify second treatment has no price yet
      let treatment2Data = await payload.findByID({
        collection: 'treatments',
        id: treatment2.id
      })
      expect(treatment2Data.averagePrice).toBeNull()
      
      // Move clinic treatment to second treatment
      await payload.update({
        collection: 'clinictreatments',
        id: clinicTreatment.id,
        data: {
          treatment: treatment2.id
        }
      })
      
      // Verify first treatment no longer has price
      treatment1 = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      expect(treatment1.averagePrice).toBeNull()
      
      // Verify second treatment now has the price
      treatment2Data = await payload.findByID({
        collection: 'treatments',
        id: treatment2.id
      })
      expect(treatment2Data.averagePrice).toBe(150.00)
      
      // Cleanup
      await payload.delete({
        collection: 'treatments',
        id: treatment2.id
      })
    })
    
  })
  
  describe('Edge Cases and Error Handling', () => {
    
    test('should handle null and undefined prices gracefully', async () => {
      // Create clinic treatments with null/undefined prices
      const clinicTreatment1 = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: null,
          available: true,
        }
      })
      
      const clinicTreatment2 = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          // price intentionally omitted (undefined)
          available: true,
        }
      })
      
      const clinicTreatment3 = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 100.00,
          available: true,
        }
      })
      
      testClinicTreatmentIds.push(clinicTreatment1.id, clinicTreatment2.id, clinicTreatment3.id)
      
      // Should only consider the valid price (100.00)
      const treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      
      expect(treatment.averagePrice).toBe(100.00)
    })
    
    test('should handle very small and very large prices', async () => {
      // Create clinic treatments with extreme prices
      const smallPriceCT = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 0.01,
          available: true,
        }
      })
      
      const largePriceCT = await payload.create({
        collection: 'clinictreatments',
        data: {
          clinic: testClinicId,
          treatment: testTreatmentId,
          price: 999999.99,
          available: true,
        }
      })
      
      testClinicTreatmentIds.push(smallPriceCT.id, largePriceCT.id)
      
      // Should calculate average correctly: (0.01 + 999999.99) / 2 = 500000
      const treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      
      expect(treatment.averagePrice).toBe(500000.00)
    })
    
  })
  
})

// Helper functions for test setup and cleanup

async function setupTestData() {
  // Create test city first (required for clinic)
  const city = await payload.create({
    collection: 'cities',
    data: {
      name: 'Test City for Prices',
      country: 'test-country-id', // This would need to exist
    }
  })
  
  testCityId = city.id
  
  // Create test clinic
  const clinic = await payload.create({
    collection: 'clinics',
    data: {
      name: 'Test Price Clinic',
      email: 'prices@clinic.com',
      phone: '+1234567890',
      address: '789 Price St',
      city: city.id,
    }
  })
  testClinicId = clinic.id
  
  // Create test treatment
  const treatment = await payload.create({
    collection: 'treatments',
    data: {
      name: 'Test Price Treatment',
      description: 'A test treatment for price calculations',
    }
  })
  testTreatmentId = treatment.id
}

async function cleanupTestData() {
  // Delete test clinic treatments
  for (const clinicTreatmentId of testClinicTreatmentIds) {
    try {
      await payload.delete({
        collection: 'clinictreatments',
        id: clinicTreatmentId
      })
    } catch (_error) {
      // Clinic treatment might already be deleted, ignore error
    }
  }
  
  // Delete test entities
  if (testTreatmentId) {
    await payload.delete({
      collection: 'treatments',
      id: testTreatmentId
    })
  }
  
  if (testClinicId) {
    await payload.delete({
      collection: 'clinics',
      id: testClinicId
    })
  }
  
  if (testCityId) {
    await payload.delete({
      collection: 'cities',
      id: testCityId
    })
  }
}