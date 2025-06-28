/**
 * Integration tests for rating calculation hooks
 * 
 * This test suite validates that the hooks properly calculate average ratings
 * for clinics, doctors, and treatments based on approved reviews.
 */

import { getPayload } from 'payload'
import config from '../../payload.config'

// Mock Payload instance for testing
let payload: any = null

// Test data IDs (will be populated during test setup)
let testClinicId: string
let testDoctorId: string 
let testTreatmentId: string
let testCityId: string
let testReviewIds: string[] = []

describe('Rating Calculation Hooks Integration Tests', () => {
  
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
    testReviewIds = []
  })
  
  describe('Review Creation and Rating Calculation', () => {
    
    test('should calculate average rating when approved review is created', async () => {
      // Create an approved review
      const review = await payload.create({
        collection: 'review',
        data: {
          clinic: testClinicId,
          starRating: 4,
          status: 'approved',
          reviewerName: 'Test Reviewer',
          content: 'Great service!',
        }
      })
      
      testReviewIds.push(review.id)
      
      // Fetch the clinic and verify average rating was calculated
      const clinic = await payload.findByID({
        collection: 'clinics',
        id: testClinicId
      })
      
      expect(clinic.averageRating).toBe(4)
    })
    
    test('should update average rating when multiple approved reviews exist', async () => {
      // Create multiple approved reviews with different ratings
      const review1 = await payload.create({
        collection: 'review',
        data: {
          clinic: testClinicId,
          starRating: 5,
          status: 'approved',
          reviewerName: 'Reviewer 1',
          content: 'Excellent!',
        }
      })
      
      const review2 = await payload.create({
        collection: 'review',
        data: {
          clinic: testClinicId,
          starRating: 3,
          status: 'approved',
          reviewerName: 'Reviewer 2', 
          content: 'Good service',
        }
      })
      
      testReviewIds.push(review1.id, review2.id)
      
      // Expected average: (5 + 3) / 2 = 4
      const clinic = await payload.findByID({
        collection: 'clinics',
        id: testClinicId
      })
      
      expect(clinic.averageRating).toBe(4)
    })
    
    test('should ignore non-approved reviews in calculation', async () => {
      // Create one approved and one pending review
      const approvedReview = await payload.create({
        collection: 'review',
        data: {
          clinic: testClinicId,
          starRating: 5,
          status: 'approved',
          reviewerName: 'Approved Reviewer',
          content: 'Great!',
        }
      })
      
      const pendingReview = await payload.create({
        collection: 'review',
        data: {
          clinic: testClinicId,
          starRating: 1,
          status: 'pending',
          reviewerName: 'Pending Reviewer',
          content: 'Bad service',
        }
      })
      
      testReviewIds.push(approvedReview.id, pendingReview.id)
      
      // Should only consider the approved review (rating: 5)
      const clinic = await payload.findByID({
        collection: 'clinics',
        id: testClinicId
      })
      
      expect(clinic.averageRating).toBe(5)
    })
    
    test('should set rating to null when no approved reviews exist', async () => {
      // Create only a rejected review
      const rejectedReview = await payload.create({
        collection: 'review',
        data: {
          clinic: testClinicId,
          starRating: 3,
          status: 'rejected',
          reviewerName: 'Rejected Reviewer',
          content: 'Mediocre',
        }
      })
      
      testReviewIds.push(rejectedReview.id)
      
      // Should have null rating since no approved reviews
      const clinic = await payload.findByID({
        collection: 'clinics',
        id: testClinicId
      })
      
      expect(clinic.averageRating).toBeNull()
    })
    
  })
  
  describe('Review Updates and Rating Changes', () => {
    
    test('should update rating when review status changes to approved', async () => {
      // Create a pending review
      const review = await payload.create({
        collection: 'review',
        data: {
          clinic: testClinicId,
          starRating: 4,
          status: 'pending',
          reviewerName: 'Test Reviewer',
          content: 'Pending review',
        }
      })
      
      testReviewIds.push(review.id)
      
      // Initially should have null rating
      let clinic = await payload.findByID({
        collection: 'clinics',
        id: testClinicId
      })
      expect(clinic.averageRating).toBeNull()
      
      // Update review to approved
      await payload.update({
        collection: 'review',
        id: review.id,
        data: {
          status: 'approved'
        }
      })
      
      // Now should have the rating
      clinic = await payload.findByID({
        collection: 'clinics',
        id: testClinicId
      })
      expect(clinic.averageRating).toBe(4)
    })
    
    test('should update rating when review star rating changes', async () => {
      // Create an approved review
      const review = await payload.create({
        collection: 'review',
        data: {
          clinic: testClinicId,
          starRating: 3,
          status: 'approved',
          reviewerName: 'Test Reviewer',
          content: 'Initial rating',
        }
      })
      
      testReviewIds.push(review.id)
      
      // Verify initial rating
      let clinic = await payload.findByID({
        collection: 'clinics',
        id: testClinicId
      })
      expect(clinic.averageRating).toBe(3)
      
      // Update the star rating
      await payload.update({
        collection: 'review',
        id: review.id,
        data: {
          starRating: 5
        }
      })
      
      // Verify updated rating
      clinic = await payload.findByID({
        collection: 'clinics',
        id: testClinicId
      })
      expect(clinic.averageRating).toBe(5)
    })
    
  })
  
  describe('Review Deletion and Rating Updates', () => {
    
    test('should update rating when approved review is deleted', async () => {
      // Create two approved reviews
      const review1 = await payload.create({
        collection: 'review',
        data: {
          clinic: testClinicId,
          starRating: 5,
          status: 'approved',
          reviewerName: 'Reviewer 1',
          content: 'Excellent!',
        }
      })
      
      const review2 = await payload.create({
        collection: 'review',
        data: {
          clinic: testClinicId,
          starRating: 3,
          status: 'approved',
          reviewerName: 'Reviewer 2',
          content: 'Good service',
        }
      })
      
      testReviewIds.push(review1.id, review2.id)
      
      // Verify average rating (5 + 3) / 2 = 4
      let clinic = await payload.findByID({
        collection: 'clinics',
        id: testClinicId
      })
      expect(clinic.averageRating).toBe(4)
      
      // Delete one review
      await payload.delete({
        collection: 'review',
        id: review1.id
      })
      
      // Remove from cleanup list since it's deleted
      testReviewIds = testReviewIds.filter(id => id !== review1.id)
      
      // Verify updated rating (only review2 with rating 3 remains)
      clinic = await payload.findByID({
        collection: 'clinics',
        id: testClinicId
      })
      expect(clinic.averageRating).toBe(3)
    })
    
    test('should set rating to null when last approved review is deleted', async () => {
      // Create one approved review
      const review = await payload.create({
        collection: 'review',
        data: {
          clinic: testClinicId,
          starRating: 4,
          status: 'approved',
          reviewerName: 'Last Reviewer',
          content: 'Final review',
        }
      })
      
      testReviewIds.push(review.id)
      
      // Verify rating exists
      let clinic = await payload.findByID({
        collection: 'clinics',
        id: testClinicId
      })
      expect(clinic.averageRating).toBe(4)
      
      // Delete the review
      await payload.delete({
        collection: 'review',
        id: review.id
      })
      
      testReviewIds = testReviewIds.filter(id => id !== review.id)
      
      // Verify rating is now null
      clinic = await payload.findByID({
        collection: 'clinics',
        id: testClinicId
      })
      expect(clinic.averageRating).toBeNull()
    })
    
  })
  
  describe('Doctor and Treatment Rating Calculations', () => {
    
    test('should calculate doctor average rating from reviews', async () => {
      // Create reviews for the doctor
      const review1 = await payload.create({
        collection: 'review',
        data: {
          doctor: testDoctorId,
          starRating: 5,
          status: 'approved',
          reviewerName: 'Patient 1',
          content: 'Great doctor!',
        }
      })
      
      const review2 = await payload.create({
        collection: 'review',
        data: {
          doctor: testDoctorId,
          starRating: 4,
          status: 'approved',
          reviewerName: 'Patient 2',
          content: 'Very helpful',
        }
      })
      
      testReviewIds.push(review1.id, review2.id)
      
      // Verify doctor average rating (5 + 4) / 2 = 4.5
      const doctor = await payload.findByID({
        collection: 'doctors',
        id: testDoctorId
      })
      
      expect(doctor.averageRating).toBe(4.5)
    })
    
    test('should calculate treatment average rating from reviews', async () => {
      // Create reviews for the treatment
      const review1 = await payload.create({
        collection: 'review',
        data: {
          treatment: testTreatmentId,
          starRating: 3,
          status: 'approved',
          reviewerName: 'Patient 1',  
          content: 'Treatment was okay',
        }
      })
      
      const review2 = await payload.create({
        collection: 'review',
        data: {
          treatment: testTreatmentId,
          starRating: 5,
          status: 'approved',
          reviewerName: 'Patient 2',
          content: 'Excellent treatment!',
        }
      })
      
      testReviewIds.push(review1.id, review2.id)
      
      // Verify treatment average rating (3 + 5) / 2 = 4
      const treatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatmentId
      })
      
      expect(treatment.averageRating).toBe(4)
    })
    
  })
  
  describe('Relationship Changes', () => {
    
    test('should update both old and new entities when review relationship changes', async () => {
      // Create another clinic for testing relationship changes
      const clinic2 = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic 2',
          email: 'clinic2@test.com',
          phone: '+1234567890',
          address: '456 Test Ave',
          city: testCityId,
        }
      })
      
      // Create a review for the first clinic
      const review = await payload.create({
        collection: 'review',
        data: {
          clinic: testClinicId,
          starRating: 4,
          status: 'approved',
          reviewerName: 'Test Reviewer',
          content: 'Good service',
        }
      })
      
      testReviewIds.push(review.id)
      
      // Verify first clinic has the rating
      let clinic1 = await payload.findByID({
        collection: 'clinics',
        id: testClinicId
      })
      expect(clinic1.averageRating).toBe(4)
      
      // Verify second clinic has no rating yet
      let clinic2Data = await payload.findByID({
        collection: 'clinics',
        id: clinic2.id
      })
      expect(clinic2Data.averageRating).toBeNull()
      
      // Move review to second clinic
      await payload.update({
        collection: 'review',
        id: review.id,
        data: {
          clinic: clinic2.id
        }
      })
      
      // Verify first clinic no longer has rating
      clinic1 = await payload.findByID({
        collection: 'clinics',
        id: testClinicId
      })
      expect(clinic1.averageRating).toBeNull()
      
      // Verify second clinic now has the rating
      clinic2Data = await payload.findByID({
        collection: 'clinics',
        id: clinic2.id
      })
      expect(clinic2Data.averageRating).toBe(4)
      
      // Cleanup
      await payload.delete({
        collection: 'clinics',
        id: clinic2.id
      })
    })
    
  })
  
})

// Helper functions for test setup and cleanup

async function setupTestData() {
  // Create test city first (required for clinic)
  const city = await payload.create({
    collection: 'cities',
    data: {
      name: 'Test City',
      country: 'test-country-id', // This would need to exist
    }
  })
  
  testCityId = city.id
  
  // Create test clinic
  const clinic = await payload.create({
    collection: 'clinics',
    data: {
      name: 'Test Clinic',
      email: 'test@clinic.com',
      phone: '+1234567890',
      address: '123 Test St',
      city: city.id,
    }
  })
  testClinicId = clinic.id
  
  // Create test medical specialty
  const specialty = await payload.create({
    collection: 'medicalspecialties',
    data: {
      name: 'Test Specialty',
      description: 'Test specialty description'
    }
  })
  
  // Create test doctor
  const doctor = await payload.create({
    collection: 'doctors',
    data: {
      firstName: 'Dr. Test',
      lastName: 'Doctor',
      email: 'doctor@test.com',
      phone: '+1234567890',
      specialties: [specialty.id],
    }
  })
  testDoctorId = doctor.id
  
  // Create test treatment
  const treatment = await payload.create({
    collection: 'treatments',
    data: {
      name: 'Test Treatment',
      description: 'A test treatment',
    }
  })
  testTreatmentId = treatment.id
}

async function cleanupTestData() {
  // Delete test reviews
  for (const reviewId of testReviewIds) {
    try {
      await payload.delete({
        collection: 'review',
        id: reviewId
      })
    } catch (_error) {
      // Review might already be deleted, ignore error
    }
  }
  
  // Delete test entities
  if (testTreatmentId) {
    await payload.delete({
      collection: 'treatments',
      id: testTreatmentId
    })
  }
  
  if (testDoctorId) {
    await payload.delete({
      collection: 'doctors', 
      id: testDoctorId
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