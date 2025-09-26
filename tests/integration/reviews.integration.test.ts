import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { mockUsers } from '../unit/helpers/mockUsers'

describe('Reviews Integration Tests', () => {
  let payload: Payload
  const slugPrefix = testSlug('reviews.integration.test.ts')
  let testClinic: any
  let testDoctor: any
  let testTreatment: any
  let testPatient: any
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
          city: cities[0].id,
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

    // Create test doctor
    testDoctor = await payload.create({
      collection: 'doctors',
      data: {
        title: 'dr',
        firstName: 'Review',
        lastName: 'Doctor',
        clinic: testClinic.id,
        qualifications: ['MD'],
        languages: ['english'],
        slug: `${slugPrefix}-doctor`,
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
            children: [{ text: 'Test treatment for reviews' }],
          },
        ],
        averagePrice: 100,
      },
      overrideAccess: true,
    })

    // Create test patient
    testPatient = await payload.create({
      collection: 'patients',
      data: {
        firstName: 'Test',
        lastName: 'Patient',
        email: `${slugPrefix}-patient@example.com`,
        dateOfBirth: '1990-01-01',
      },
      overrideAccess: true,
    })
  })

  afterEach(async () => {
    // Clean up reviews
    const { docs } = await payload.find({
      collection: 'reviews',
      where: { 
        or: [
          { clinic: { equals: testClinic.id } },
          { doctor: { equals: testDoctor.id } },
          { treatment: { equals: testTreatment.id } }
        ]
      },
      limit: 100,
      overrideAccess: true,
    })
    
    for (const doc of docs) {
      await payload.delete({ 
        collection: 'reviews', 
        id: doc.id, 
        overrideAccess: true 
      })
    }
  })

  describe('Access Control Matrix', () => {
    const testReview = {
      reviewDate: new Date().toISOString(),
      starRating: 5,
      comment: 'Excellent service!',
      patient: testPatient.id,
      clinic: testClinic.id,
      doctor: testDoctor.id,
      treatment: testTreatment.id,
      status: 'pending',
    }

    it('allows platform staff to read all reviews', async () => {
      // Create review as patient
      const created = await payload.create({
        collection: 'reviews',
        data: testReview,
        user: mockUsers.patient(testPatient.id),
      })

      // Platform staff can read any review
      const read = await payload.findByID({
        collection: 'reviews',
        id: created.id,
        user: mockUsers.platform(),
      })
      expect(read.id).toBe(created.id)
      expect(read.starRating).toBe(5)
    })

    it('allows patients to create reviews', async () => {
      const created = await payload.create({
        collection: 'reviews',
        data: testReview,
        user: mockUsers.patient(testPatient.id),
      })

      expect(created.id).toBeDefined()
      expect(created.starRating).toBe(5)
      expect(created.patient).toBe(testPatient.id)
    })

    it('allows platform staff to create reviews', async () => {
      const created = await payload.create({
        collection: 'reviews',
        data: testReview,
        user: mockUsers.platform(),
      })

      expect(created.id).toBeDefined()
      expect(created.starRating).toBe(5)
    })

    it('restricts review updates to platform staff only', async () => {
      // Create review as patient
      const created = await payload.create({
        collection: 'reviews',
        data: testReview,
        user: mockUsers.patient(testPatient.id),
      })

      // Platform staff can update
      const updated = await payload.update({
        collection: 'reviews',
        id: created.id,
        data: { status: 'approved' },
        user: mockUsers.platform(),
      })
      expect(updated.status).toBe('approved')

      // Patient cannot update their own review
      await expect(
        payload.update({
          collection: 'reviews',
          id: created.id,
          data: { starRating: 4 },
          user: mockUsers.patient(testPatient.id),
        })
      ).rejects.toThrow()

      // Clinic staff cannot update reviews
      await expect(
        payload.update({
          collection: 'reviews',
          id: created.id,
          data: { status: 'rejected' },
          user: mockUsers.clinic(),
        })
      ).rejects.toThrow()
    })

    it('restricts review deletion to platform staff only', async () => {
      const created = await payload.create({
        collection: 'reviews',
        data: testReview,
        user: mockUsers.patient(testPatient.id),
      })

      // Patient cannot delete their own review
      await expect(
        payload.delete({
          collection: 'reviews',
          id: created.id,
          user: mockUsers.patient(testPatient.id),
        })
      ).rejects.toThrow()

      // Clinic staff cannot delete reviews
      await expect(
        payload.delete({
          collection: 'reviews',
          id: created.id,
          user: mockUsers.clinic(),
        })
      ).rejects.toThrow()

      // Platform staff can delete
      await payload.delete({
        collection: 'reviews',
        id: created.id,
        user: mockUsers.platform(),
      })
    })

    it('denies review creation for unauthorized users', async () => {
      // Anonymous users cannot create reviews
      await expect(
        payload.create({
          collection: 'reviews',
          data: testReview,
          user: null,
        })
      ).rejects.toThrow()

      // Clinic staff cannot create reviews directly
      await expect(
        payload.create({
          collection: 'reviews',
          data: testReview,
          user: mockUsers.clinic(),
        })
      ).rejects.toThrow()
    })
  })

  describe('Rating Aggregation Hook Validation', () => {
    it('updates clinic averageRating after review creation', async () => {
      // Get initial clinic rating (should be null/undefined)
      const initialClinic = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
        overrideAccess: true,
      })
      expect(initialClinic.averageRating).toBeUndefined()

      // Create first review with 5 stars and approve it
      const review1 = await payload.create({
        collection: 'reviews',
        data: {
          reviewDate: new Date().toISOString(),
          starRating: 5,
          comment: 'Excellent!',
          patient: testPatient.id,
          clinic: testClinic.id,
          status: 'approved',
        },
        user: mockUsers.platform(),
      })

      // Check clinic rating after first review
      const clinicAfterFirst = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
        overrideAccess: true,
      })
      expect(clinicAfterFirst.averageRating).toBe(5)

      // Create second review with 3 stars and approve it
      const review2 = await payload.create({
        collection: 'reviews',
        data: {
          reviewDate: new Date().toISOString(),
          starRating: 3,
          comment: 'Average service',
          patient: testPatient.id,
          clinic: testClinic.id,
          status: 'approved',
        },
        user: mockUsers.platform(),
      })

      // Check clinic rating after second review (should be 4.0)
      const clinicAfterSecond = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
        overrideAccess: true,
      })
      expect(clinicAfterSecond.averageRating).toBe(4)
    })

    it('updates doctor averageRating after review creation', async () => {
      // Get initial doctor rating (should be null/undefined)
      const initialDoctor = await payload.findByID({
        collection: 'doctors',
        id: testDoctor.id,
        overrideAccess: true,
      })
      expect(initialDoctor.averageRating).toBeUndefined()

      // Create review for doctor with 4 stars and approve it
      await payload.create({
        collection: 'reviews',
        data: {
          reviewDate: new Date().toISOString(),
          starRating: 4,
          comment: 'Good doctor',
          patient: testPatient.id,
          doctor: testDoctor.id,
          status: 'approved',
        },
        user: mockUsers.platform(),
      })

      // Check doctor rating
      const doctorAfterReview = await payload.findByID({
        collection: 'doctors',
        id: testDoctor.id,
        overrideAccess: true,
      })
      expect(doctorAfterReview.averageRating).toBe(4)
    })

    it('updates treatment averageRating after review creation', async () => {
      // Get initial treatment rating (should be null/undefined)
      const initialTreatment = await payload.findByID({
        collection: 'treatments',
        id: testTreatment.id,
        overrideAccess: true,
      })
      expect(initialTreatment.averageRating).toBeUndefined()

      // Create review for treatment with 5 stars and approve it
      await payload.create({
        collection: 'reviews',
        data: {
          reviewDate: new Date().toISOString(),
          starRating: 5,
          comment: 'Great treatment',
          patient: testPatient.id,
          treatment: testTreatment.id,
          status: 'approved',
        },
        user: mockUsers.platform(),
      })

      // Check treatment rating
      const treatmentAfterReview = await payload.findByID({
        collection: 'treatments',
        id: testTreatment.id,
        overrideAccess: true,
      })
      expect(treatmentAfterReview.averageRating).toBe(5)
    })

    it('only includes approved reviews in rating calculations', async () => {
      // Create pending review (should not affect rating)
      await payload.create({
        collection: 'reviews',
        data: {
          reviewDate: new Date().toISOString(),
          starRating: 1,
          comment: 'Pending review',
          patient: testPatient.id,
          clinic: testClinic.id,
          status: 'pending',
        },
        user: mockUsers.patient(testPatient.id),
      })

      // Rating should still be null/undefined
      const clinicAfterPending = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
        overrideAccess: true,
      })
      expect(clinicAfterPending.averageRating).toBeUndefined()

      // Create approved review
      await payload.create({
        collection: 'reviews',
        data: {
          reviewDate: new Date().toISOString(),
          starRating: 4,
          comment: 'Good service',
          patient: testPatient.id,
          clinic: testClinic.id,
          status: 'approved',
        },
        user: mockUsers.platform(),
      })

      // Rating should now be 4 (only approved review counted)
      const clinicAfterApproved = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
        overrideAccess: true,
      })
      expect(clinicAfterApproved.averageRating).toBe(4)
    })

    it('updates ratings when review is deleted', async () => {
      // Create two approved reviews
      const review1 = await payload.create({
        collection: 'reviews',
        data: {
          reviewDate: new Date().toISOString(),
          starRating: 5,
          comment: 'Excellent!',
          patient: testPatient.id,
          clinic: testClinic.id,
          status: 'approved',
        },
        user: mockUsers.platform(),
      })

      const review2 = await payload.create({
        collection: 'reviews',
        data: {
          reviewDate: new Date().toISOString(),
          starRating: 3,
          comment: 'Average',
          patient: testPatient.id,
          clinic: testClinic.id,
          status: 'approved',
        },
        user: mockUsers.platform(),
      })

      // Verify average is 4.0
      const clinicAfterBoth = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
        overrideAccess: true,
      })
      expect(clinicAfterBoth.averageRating).toBe(4)

      // Delete one review
      await payload.delete({
        collection: 'reviews',
        id: review1.id,
        user: mockUsers.platform(),
      })

      // Rating should now be 3.0 (only the second review remains)
      const clinicAfterDelete = await payload.findByID({
        collection: 'clinics',
        id: testClinic.id,
        overrideAccess: true,
      })
      expect(clinicAfterDelete.averageRating).toBe(3)
    })
  })

  describe('Relationship Integrity', () => {
    it('requires valid patient reference', async () => {
      await expect(
        payload.create({
          collection: 'reviews',
          data: {
            reviewDate: new Date().toISOString(),
            starRating: 5,
            comment: 'Invalid patient',
            patient: 999999, // Non-existent patient ID
            clinic: testClinic.id,
            status: 'pending',
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('requires valid clinic reference when provided', async () => {
      await expect(
        payload.create({
          collection: 'reviews',
          data: {
            reviewDate: new Date().toISOString(),
            starRating: 5,
            comment: 'Invalid clinic',
            patient: testPatient.id,
            clinic: 999999, // Non-existent clinic ID
            status: 'pending',
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('populates relationships correctly', async () => {
      const review = await payload.create({
        collection: 'reviews',
        data: {
          reviewDate: new Date().toISOString(),
          starRating: 4,
          comment: 'Test relationships',
          patient: testPatient.id,
          clinic: testClinic.id,
          doctor: testDoctor.id,
          treatment: testTreatment.id,
          status: 'approved',
        },
        user: mockUsers.platform(),
      })

      // Fetch with populated relationships
      const reviewWithRels = await payload.findByID({
        collection: 'reviews',
        id: review.id,
        depth: 1,
        user: mockUsers.platform(),
      })

      expect(typeof reviewWithRels.patient).toBe('object')
      expect(typeof reviewWithRels.clinic).toBe('object')
      expect(typeof reviewWithRels.doctor).toBe('object')
      expect(typeof reviewWithRels.treatment).toBe('object')

      expect((reviewWithRels.patient as any).firstName).toBe('Test')
      expect((reviewWithRels.clinic as any).name).toBe(testClinic.name)
      expect((reviewWithRels.doctor as any).firstName).toBe('Review')
      expect((reviewWithRels.treatment as any).name).toBe(testTreatment.name)
    })
  })

  describe('Field Validation', () => {
    it('requires reviewDate, starRating, and patient', async () => {
      await expect(
        payload.create({
          collection: 'reviews',
          data: {
            comment: 'Missing required fields',
            clinic: testClinic.id,
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('validates starRating range (1-5)', async () => {
      // Test invalid low rating
      await expect(
        payload.create({
          collection: 'reviews',
          data: {
            reviewDate: new Date().toISOString(),
            starRating: 0, // Invalid: too low
            comment: 'Invalid rating',
            patient: testPatient.id,
            clinic: testClinic.id,
            status: 'pending',
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()

      // Test invalid high rating
      await expect(
        payload.create({
          collection: 'reviews',
          data: {
            reviewDate: new Date().toISOString(),
            starRating: 6, // Invalid: too high
            comment: 'Invalid rating',
            patient: testPatient.id,
            clinic: testClinic.id,
            status: 'pending',
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()

      // Test valid rating
      const validReview = await payload.create({
        collection: 'reviews',
        data: {
          reviewDate: new Date().toISOString(),
          starRating: 3, // Valid: in range
          comment: 'Valid rating',
          patient: testPatient.id,
          clinic: testClinic.id,
          status: 'pending',
        },
        user: mockUsers.platform(),
      })

      expect(validReview.starRating).toBe(3)
    })
  })

  describe('Soft Delete Behavior', () => {
    it('soft deletes reviews when trash is enabled', async () => {
      const review = await payload.create({
        collection: 'reviews',
        data: {
          reviewDate: new Date().toISOString(),
          starRating: 4,
          comment: 'To be soft deleted',
          patient: testPatient.id,
          clinic: testClinic.id,
          status: 'approved',
        },
        user: mockUsers.platform(),
      })

      // Delete the review
      await payload.delete({
        collection: 'reviews',
        id: review.id,
        user: mockUsers.platform(),
      })

      // Should not be found in normal queries
      await expect(
        payload.findByID({
          collection: 'reviews',
          id: review.id,
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })
  })
})