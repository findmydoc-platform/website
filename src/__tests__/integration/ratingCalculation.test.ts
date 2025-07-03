/**
 * Integration tests for rating calculation hooks
 * Tests actual PayloadCMS operations and hook execution
 */

import { getPayload } from 'payload'
import config from '@payload-config'
import { Payload } from 'payload'

// Helper function to create rich text content
const createRichText = (text: string) => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [
          {
            type: 'text',
            text,
          },
        ],
      },
    ],
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
})

describe('Rating Calculation Hooks - Integration Tests', () => {
  let payload: Payload
  let testCountry: any
  let testCity: any
  let testMedicalSpecialty: any
  let testBasicUser: any
  let testPatient: any
  let testClinic: any

  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  beforeEach(async () => {
    // Clear test data before each test
    await payload.delete({ collection: 'review', where: {} })
    await payload.delete({ collection: 'clinics', where: {} })
    await payload.delete({ collection: 'doctors', where: {} })
    await payload.delete({ collection: 'treatments', where: {} })
    await payload.delete({ collection: 'plattformStaff', where: {} })
    await payload.delete({ collection: 'basicUsers', where: {} })
    await payload.delete({ collection: 'cities', where: {} })
    await payload.delete({ collection: 'countries', where: {} })
    await payload.delete({ collection: 'medical-specialties', where: {} })

    // Create shared test dependencies
    testCountry = await payload.create({
      collection: 'countries',
      data: {
        name: 'Turkey',
        isoCode: 'TR',
        language: 'tr',
        currency: 'TRY',
      },
    })

    testCity = await payload.create({
      collection: 'cities',
      data: {
        name: 'Istanbul',
        country: testCountry.id,
        airportcode: 'IST',
        coordinates: [28.9784, 41.0082],
      },
    })

    testMedicalSpecialty = await payload.create({
      collection: 'medical-specialties',
      data: {
        name: 'General Medicine',
        description: 'General medical practice',
      },
    })

    testBasicUser = await payload.create({
      collection: 'basicUsers',
      data: {
        email: 'patient@test.com',
        supabaseUserId: 'test-patient-id',
        userType: 'platform',
      },
    })

    testPatient = await payload.create({
      collection: 'plattformStaff',
      data: {
        user: testBasicUser.id,
        firstName: 'Test',
        lastName: 'Patient',
        role: 'admin',
      },
    })

    testClinic = await payload.create({
      collection: 'clinics',
      data: {
        name: 'Test Clinic',
        description: createRichText('Test clinic for rating calculation'),
        supportedLanguages: ['english', 'turkish'],
        status: 'approved',
        address: {
          street: 'Test Street',
          houseNumber: '123',
          zipCode: 34000,
          city: testCity.id,
          country: 'Turkey',
        },
        contact: {
          phoneNumber: '+90 555 123 4567',
          email: 'test@clinic.com',
        },
        averageRating: null,
      },
    })
  })

  // Helper functions
  const createTestDoctor = async (clinicId?: number) => {
    return await payload.create({
      collection: 'doctors',
      data: {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'Dr. John Doe',
        title: 'dr',
        biography: createRichText('Test doctor biography'),
        clinic: clinicId || testClinic.id,
        qualifications: ['MD'],
        languages: ['english'],
        averageRating: null,
      },
    })
  }

  const createTestTreatment = async (name = 'General Consultation') => {
    return await payload.create({
      collection: 'treatments',
      data: {
        name,
        description: createRichText('General medical consultation'),
        medicalSpecialty: testMedicalSpecialty.id,
        averageRating: null,
      },
    })
  }

  const createTestReview = async ({
    starRating,
    comment,
    status,
    clinic,
    doctor,
    treatment,
    patient,
  }: {
    starRating: number
    comment: string
    status: 'approved' | 'pending' | 'rejected'
    clinic: any
    doctor: any
    treatment: any
    patient: any
  }) => {
    return await payload.create({
      collection: 'review',
      data: {
        starRating,
        comment,
        status,
        clinic,
        doctor,
        treatment,
        patient,
        reviewDate: new Date().toISOString(),
      },
    })
  }

  describe('Clinic Rating Calculation', () => {
    it('should calculate clinic average rating when review is created', async () => {
      const doctor = await createTestDoctor()
      const treatment = await createTestTreatment()

      // Create first review
      await createTestReview({
        starRating: 4,
        comment: 'Great clinic!',
        status: 'approved',
        clinic: testClinic.id,
        doctor: doctor.id,
        treatment: treatment.id,
        patient: testPatient.id,
      })

      // Check that clinic rating was updated
      const updatedClinic = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
      })
      expect(updatedClinic.averageRating).toBe(4)

      // Create second review - should update average
      await createTestReview({
        starRating: 2,
        comment: 'Not so good',
        status: 'approved',
        clinic: testClinic.id,
        doctor: doctor.id,
        treatment: treatment.id,
        patient: testPatient.id,
      })

      const finalClinic = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
      })
      expect(finalClinic.averageRating).toBe(3) // (4 + 2) / 2 = 3
    })

    it('should not include pending reviews in average calculation', async () => {
      const doctor = await createTestDoctor()
      const treatment = await createTestTreatment()

      // Create approved review
      await createTestReview({
        starRating: 5,
        comment: 'Excellent service',
        status: 'approved',
        clinic: testClinic.id,
        doctor: doctor.id,
        treatment: treatment.id,
        patient: testPatient.id,
      })

      // Create pending review - should not affect average
      await createTestReview({
        starRating: 1,
        comment: 'Bad experience',
        status: 'pending',
        clinic: testClinic.id,
        doctor: doctor.id,
        treatment: treatment.id,
        patient: testPatient.id,
      })

      const updatedClinic = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
      })
      expect(updatedClinic.averageRating).toBe(5) // Only approved review counts
    })

    it('should update clinic rating when review is deleted', async () => {
      const doctor = await createTestDoctor()
      const treatment = await createTestTreatment()

      // Create reviews
      const review1 = await createTestReview({
        starRating: 4,
        comment: 'Good service',
        status: 'approved',
        clinic: testClinic.id,
        doctor: doctor.id,
        treatment: treatment.id,
        patient: testPatient.id,
      })

      const review2 = await createTestReview({
        starRating: 2,
        comment: 'Could be better',
        status: 'approved',
        clinic: testClinic.id,
        doctor: doctor.id,
        treatment: treatment.id,
        patient: testPatient.id,
      })

      // Verify initial average
      const clinicBeforeDelete = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
      })
      expect(clinicBeforeDelete.averageRating).toBe(3) // (4 + 2) / 2 = 3

      // Delete one review
      await payload.delete({
        collection: 'review',
        id: review2.id,
      })

      // Check updated average
      const clinicAfterDelete = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
      })
      expect(clinicAfterDelete.averageRating).toBe(4) // Only review1 remains
    })

    it('should set clinic rating to null when all reviews are deleted', async () => {
      const doctor = await createTestDoctor()
      const treatment = await createTestTreatment()

      // Create review
      const review = await createTestReview({
        starRating: 5,
        comment: 'Excellent service',
        status: 'approved',
        clinic: testClinic.id,
        doctor: doctor.id,
        treatment: treatment.id,
        patient: testPatient.id,
      })

      // Verify rating is set
      const clinicWithRating = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
      })
      expect(clinicWithRating.averageRating).toBe(5)

      // Delete the review
      await payload.delete({
        collection: 'review',
        id: review.id,
      })

      // Check that rating is null
      const updatedClinic = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
      })
      expect(updatedClinic.averageRating).toBeNull()
    })
  })

  describe('Doctor Rating Calculation', () => {
    it('should calculate doctor average rating when review is created', async () => {
      const doctor = await createTestDoctor()
      const treatment = await createTestTreatment()

      // Create review
      await createTestReview({
        starRating: 4,
        comment: 'Great doctor!',
        status: 'approved',
        clinic: testClinic.id,
        doctor: doctor.id,
        treatment: treatment.id,
        patient: testPatient.id,
      })

      // Check that doctor rating was updated
      const updatedDoctor = await payload.findByID({
        collection: 'doctors',
        id: doctor.id,
      })
      expect(updatedDoctor.averageRating).toBe(4)
    })
  })

  describe('Treatment Rating Calculation', () => {
    it('should calculate treatment average rating when review is created', async () => {
      const doctor = await createTestDoctor()
      const treatment = await createTestTreatment()

      // Create review
      await createTestReview({
        starRating: 3,
        comment: 'Good treatment',
        status: 'approved',
        clinic: testClinic.id,
        doctor: doctor.id,
        treatment: treatment.id,
        patient: testPatient.id,
      })

      // Check that treatment rating was updated
      const updatedTreatment = await payload.findByID({
        collection: 'treatments',
        id: treatment.id,
      })
      expect(updatedTreatment.averageRating).toBe(3)
    })
  })

  describe('Review Status Updates', () => {
    it('should update ratings when review status changes from pending to approved', async () => {
      const doctor = await createTestDoctor()
      const treatment = await createTestTreatment()

      // Create pending review
      const review = await createTestReview({
        starRating: 5,
        comment: 'Excellent!',
        status: 'pending',
        clinic: testClinic.id,
        doctor: doctor.id,
        treatment: treatment.id,
        patient: testPatient.id,
      })

      // Initially, ratings should be null
      const clinicBefore = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
      })
      expect(clinicBefore.averageRating).toBeNull()

      // Update review status to approved
      await payload.update({
        collection: 'review',
        id: review.id,
        data: {
          status: 'approved',
        },
      })

      // Check that ratings are now updated
      const clinicAfter = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
      })
      expect(clinicAfter.averageRating).toBe(5)
    })

    it('should update ratings when review status changes from approved to rejected', async () => {
      const doctor = await createTestDoctor()
      const treatment = await createTestTreatment()

      // Create approved review
      const review = await createTestReview({
        starRating: 5,
        comment: 'Excellent!',
        status: 'approved',
        clinic: testClinic.id,
        doctor: doctor.id,
        treatment: treatment.id,
        patient: testPatient.id,
      })

      // Check initial rating
      const clinicBefore = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
      })
      expect(clinicBefore.averageRating).toBe(5)

      // Update review status to rejected
      await payload.update({
        collection: 'review',
        id: review.id,
        data: {
          status: 'rejected',
        },
      })

      // Check that ratings are now null (no approved reviews)
      const clinicAfter = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
      })
      expect(clinicAfter.averageRating).toBeNull()
    })
  })
})
