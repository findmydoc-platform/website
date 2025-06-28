/**
 * Integration tests for rating calculation hooks
 * Tests actual PayloadCMS operations and hook execution
 */

import { Payload } from 'payload'

// Declare global payload instance from Jest setup
declare const global: {
  payload: Payload
}

describe('Rating Calculation Hooks - Integration Tests', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = global.payload
    if (!payload) {
      throw new Error('Payload instance not available in global scope')
    }
  })

  beforeEach(async () => {
    // Clear test data before each test
    await payload.delete({
      collection: 'review',
      where: {},
    })
    await payload.delete({
      collection: 'clinics',
      where: {},
    })
    await payload.delete({
      collection: 'doctors',
      where: {},
    })
    await payload.delete({
      collection: 'treatments',
      where: {},
    })
    await payload.delete({
      collection: 'patients',
      where: {},
    })
  })

  describe('Clinic Rating Calculation', () => {
    test('should calculate clinic average rating when review is created', async () => {
      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          email: 'test@clinic.com',
          description: 'Test clinic for rating calculation',
          averageRating: null, // Initially no rating
        },
      })

      // Create a patient
      const patient = await payload.create({
        collection: 'patients',
        data: {
          name: 'Test Patient',
          email: 'patient@test.com',
        },
      })

      // Create first review - should update clinic average rating
      await payload.create({
        collection: 'review',
        data: {
          starRating: 5,
          comment: 'Excellent service',
          status: 'approved',
          clinic: clinic.id,
          patient: patient.id,
        },
      })

      // Verify clinic average rating was updated
      const updatedClinic = await payload.findByID({
        collection: 'clinics',
        id: clinic.id,
      })

      expect(updatedClinic.averageRating).toBe(5)

      // Add another review
      await payload.create({
        collection: 'review',
        data: {
          starRating: 3,
          comment: 'Good service',
          status: 'approved',
          clinic: clinic.id,
          patient: patient.id,
        },
      })

      // Verify average rating calculation
      const finalClinic = await payload.findByID({
        collection: 'clinics',
        id: clinic.id,
      })

      expect(finalClinic.averageRating).toBe(4) // (5 + 3) / 2 = 4
    })

    test('should not include pending reviews in average calculation', async () => {
      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          email: 'test@clinic.com',
          description: 'Test clinic for rating calculation',
        },
      })

      // Create a patient
      const patient = await payload.create({
        collection: 'patients',
        data: {
          name: 'Test Patient',
          email: 'patient@test.com',
        },
      })

      // Create approved review
      await payload.create({
        collection: 'review',
        data: {
          starRating: 5,
          comment: 'Excellent service',
          status: 'approved',
          clinic: clinic.id,
          patient: patient.id,
        },
      })

      // Create pending review (should not be counted)
      await payload.create({
        collection: 'review',
        data: {
          starRating: 1,
          comment: 'Bad service',
          status: 'pending',
          clinic: clinic.id,
          patient: patient.id,
        },
      })

      // Verify only approved review is counted
      const updatedClinic = await payload.findByID({
        collection: 'clinics',
        id: clinic.id,
      })

      expect(updatedClinic.averageRating).toBe(5) // Only the approved review counts
    })

    test('should update clinic rating when review is deleted', async () => {
      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          email: 'test@clinic.com',
          description: 'Test clinic for rating calculation',
        },
      })

      // Create a patient
      const patient = await payload.create({
        collection: 'patients',
        data: {
          name: 'Test Patient',
          email: 'patient@test.com',
        },
      })

      // Create multiple reviews
      const review1 = await payload.create({
        collection: 'review',
        data: {
          starRating: 5,
          comment: 'Excellent service',
          status: 'approved',
          clinic: clinic.id,
          patient: patient.id,
        },
      })

      await payload.create({
        collection: 'review',
        data: {
          starRating: 3,
          comment: 'Good service',
          status: 'approved',
          clinic: clinic.id,
          patient: patient.id,
        },
      })

      // Verify initial average (5 + 3) / 2 = 4
      let updatedClinic = await payload.findByID({
        collection: 'clinics',
        id: clinic.id,
      })
      expect(updatedClinic.averageRating).toBe(4)

      // Delete one review
      await payload.delete({
        collection: 'review',
        id: review1.id,
      })

      // Verify average is recalculated
      updatedClinic = await payload.findByID({
        collection: 'clinics',
        id: clinic.id,
      })
      expect(updatedClinic.averageRating).toBe(3) // Only the 3-star review remains
    })

    test('should set clinic rating to null when all reviews are deleted', async () => {
      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          email: 'test@clinic.com',
          description: 'Test clinic for rating calculation',
        },
      })

      // Create a patient
      const patient = await payload.create({
        collection: 'patients',
        data: {
          name: 'Test Patient',
          email: 'patient@test.com',
        },
      })

      // Create a review
      const review = await payload.create({
        collection: 'review',
        data: {
          starRating: 4,
          comment: 'Good service',
          status: 'approved',
          clinic: clinic.id,
          patient: patient.id,
        },
      })

      // Verify rating is set
      let updatedClinic = await payload.findByID({
        collection: 'clinics',
        id: clinic.id,
      })
      expect(updatedClinic.averageRating).toBe(4)

      // Delete the review
      await payload.delete({
        collection: 'review',
        id: review.id,
      })

      // Verify rating is null when no reviews exist
      updatedClinic = await payload.findByID({
        collection: 'clinics',
        id: clinic.id,
      })
      expect(updatedClinic.averageRating).toBeNull()
    })
  })

  describe('Doctor Rating Calculation', () => {
    test('should calculate doctor average rating when review is created', async () => {
      // Create a doctor
      const doctor = await payload.create({
        collection: 'doctors',
        data: {
          name: 'Dr. Test',
          email: 'doctor@test.com',
          bio: 'Test doctor',
          averageRating: null, // Initially no rating
        },
      })

      // Create a patient
      const patient = await payload.create({
        collection: 'patients',
        data: {
          name: 'Test Patient',
          email: 'patient@test.com',
        },
      })

      // Create review for doctor
      await payload.create({
        collection: 'review',
        data: {
          starRating: 5,
          comment: 'Great doctor',
          status: 'approved',
          doctor: doctor.id,
          patient: patient.id,
        },
      })

      // Verify doctor average rating was updated
      const updatedDoctor = await payload.findByID({
        collection: 'doctors',
        id: doctor.id,
      })

      expect(updatedDoctor.averageRating).toBe(5)
    })
  })

  describe('Treatment Rating Calculation', () => {
    test('should calculate treatment average rating when review is created', async () => {
      // Create a treatment
      const treatment = await payload.create({
        collection: 'treatments',
        data: {
          name: 'Test Treatment',
          description: 'Test treatment for rating calculation',
          averageRating: null, // Initially no rating
        },
      })

      // Create a patient
      const patient = await payload.create({
        collection: 'patients',
        data: {
          name: 'Test Patient',
          email: 'patient@test.com',
        },
      })

      // Create review for treatment
      await payload.create({
        collection: 'review',
        data: {
          starRating: 4,
          comment: 'Good treatment',
          status: 'approved',
          treatment: treatment.id,
          patient: patient.id,
        },
      })

      // Verify treatment average rating was updated
      const updatedTreatment = await payload.findByID({
        collection: 'treatments',
        id: treatment.id,
      })

      expect(updatedTreatment.averageRating).toBe(4)
    })
  })

  describe('Review Status Updates', () => {
    test('should update ratings when review status changes from pending to approved', async () => {
      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          email: 'test@clinic.com',
          description: 'Test clinic for rating calculation',
        },
      })

      // Create a patient
      const patient = await payload.create({
        collection: 'patients',
        data: {
          name: 'Test Patient',
          email: 'patient@test.com',
        },
      })

      // Create approved review
      await payload.create({
        collection: 'review',
        data: {
          starRating: 5,
          comment: 'Excellent service',
          status: 'approved',
          clinic: clinic.id,
          patient: patient.id,
        },
      })

      // Create pending review
      const pendingReview = await payload.create({
        collection: 'review',
        data: {
          starRating: 3,
          comment: 'Average service',
          status: 'pending',
          clinic: clinic.id,
          patient: patient.id,
        },
      })

      // Verify only approved review is counted
      let updatedClinic = await payload.findByID({
        collection: 'clinics',
        id: clinic.id,
      })
      expect(updatedClinic.averageRating).toBe(5)

      // Update pending review to approved
      await payload.update({
        collection: 'review',
        id: pendingReview.id,
        data: {
          status: 'approved',
        },
      })

      // Verify both reviews are now counted
      updatedClinic = await payload.findByID({
        collection: 'clinics',
        id: clinic.id,
      })
      expect(updatedClinic.averageRating).toBe(4) // (5 + 3) / 2 = 4
    })

    test('should update ratings when review status changes from approved to rejected', async () => {
      // Create a clinic
      const clinic = await payload.create({
        collection: 'clinics',
        data: {
          name: 'Test Clinic',
          email: 'test@clinic.com',
          description: 'Test clinic for rating calculation',
        },
      })

      // Create a patient
      const patient = await payload.create({
        collection: 'patients',
        data: {
          name: 'Test Patient',
          email: 'patient@test.com',
        },
      })

      // Create approved reviews
      await payload.create({
        collection: 'review',
        data: {
          starRating: 5,
          comment: 'Excellent service',
          status: 'approved',
          clinic: clinic.id,
          patient: patient.id,
        },
      })

      const reviewToReject = await payload.create({
        collection: 'review',
        data: {
          starRating: 1,
          comment: 'Bad service',
          status: 'approved',
          clinic: clinic.id,
          patient: patient.id,
        },
      })

      // Verify both reviews are counted
      let updatedClinic = await payload.findByID({
        collection: 'clinics',
        id: clinic.id,
      })
      expect(updatedClinic.averageRating).toBe(3) // (5 + 1) / 2 = 3

      // Update approved review to rejected
      await payload.update({
        collection: 'review',
        id: reviewToReject.id,
        data: {
          status: 'rejected',
        },
      })

      // Verify only the remaining approved review is counted
      updatedClinic = await payload.findByID({
        collection: 'clinics',
        id: clinic.id,
      })
      expect(updatedClinic.averageRating).toBe(5) // Only the 5-star review remains
    })
  })
})