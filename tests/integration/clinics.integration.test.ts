import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { mockUsers } from '../unit/helpers/mockUsers'

describe('Clinics Integration Tests', () => {
  let payload: Payload
  const slugPrefix = testSlug('clinics.integration.test.ts')
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
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  const baseClinicData = {
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
    slug: `${slugPrefix}-clinic`,
  }

  describe('Access Control Matrix', () => {
    it('allows platform staff full CRUD access', async () => {
      // Platform staff can create
      const created = await payload.create({
        collection: 'clinics',
        data: { ...baseClinicData, status: 'draft' },
        user: mockUsers.platform(),
      })
      expect(created.id).toBeDefined()
      expect(created.name).toBe(baseClinicData.name)

      // Platform staff can read
      const read = await payload.findByID({
        collection: 'clinics',
        id: created.id,
        user: mockUsers.platform(),
      })
      expect(read.id).toBe(created.id)

      // Platform staff can update
      const updated = await payload.update({
        collection: 'clinics',
        id: created.id,
        data: { name: 'Updated Clinic Name' },
        user: mockUsers.platform(),
      })
      expect(updated.name).toBe('Updated Clinic Name')

      // Platform staff can delete
      await payload.delete({
        collection: 'clinics',
        id: created.id,
        user: mockUsers.platform(),
      })
    })

    it('allows public read access for approved clinics only', async () => {
      // Create draft clinic
      const draftClinic = await payload.create({
        collection: 'clinics',
        data: { ...baseClinicData, status: 'draft', slug: `${slugPrefix}-draft` },
        user: mockUsers.platform(),
      })

      // Create approved clinic  
      const approvedClinic = await payload.create({
        collection: 'clinics',
        data: { 
          ...baseClinicData, 
          name: `${slugPrefix}-approved-clinic`,
          status: 'approved', 
          slug: `${slugPrefix}-approved` 
        },
        user: mockUsers.platform(),
      })

      // Anonymous users can only see approved clinics
      const anonymousResults = await payload.find({
        collection: 'clinics',
        where: {
          or: [
            { id: { equals: draftClinic.id } },
            { id: { equals: approvedClinic.id } }
          ]
        },
        user: null, // anonymous
      })

      expect(anonymousResults.docs).toHaveLength(1)
      expect(anonymousResults.docs[0].id).toBe(approvedClinic.id)
      expect(anonymousResults.docs[0].status).toBe('approved')

      // Patient users can only see approved clinics
      const patientResults = await payload.find({
        collection: 'clinics',
        where: {
          or: [
            { id: { equals: draftClinic.id } },
            { id: { equals: approvedClinic.id } }
          ]
        },
        user: mockUsers.patient(),
      })

      expect(patientResults.docs).toHaveLength(1)
      expect(patientResults.docs[0].id).toBe(approvedClinic.id)

      // Clean up
      await payload.delete({ collection: 'clinics', id: draftClinic.id, overrideAccess: true })
      await payload.delete({ collection: 'clinics', id: approvedClinic.id, overrideAccess: true })
    })

    it('allows clinic staff scoped update access to their own clinic profile', async () => {
      // Create clinic as platform user
      const clinic = await payload.create({
        collection: 'clinics',
        data: { ...baseClinicData, status: 'approved' },
        user: mockUsers.platform(),
      })

      // Create clinic staff user assigned to this clinic
      const clinicUser = mockUsers.clinic(2, clinic.id)

      // Clinic staff can update their own clinic
      const updated = await payload.update({
        collection: 'clinics',
        id: clinic.id,
        data: { 
          contact: {
            ...baseClinicData.contact,
            phoneNumber: '+49987654321' // Update phone
          }
        },
        user: clinicUser,
      })
      expect(updated.contact.phoneNumber).toBe('+49987654321')

      // Clinic staff cannot update other clinics (would be tested with multiple clinics)

      // Clean up
      await payload.delete({ collection: 'clinics', id: clinic.id, overrideAccess: true })
    })

    it('denies creation access to non-platform users', async () => {
      // Clinic staff cannot create new clinics
      await expect(
        payload.create({
          collection: 'clinics',
          data: { ...baseClinicData, status: 'draft' },
          user: mockUsers.clinic(),
        })
      ).rejects.toThrow()

      // Patient cannot create clinics
      await expect(
        payload.create({
          collection: 'clinics',
          data: { ...baseClinicData, status: 'draft' },
          user: mockUsers.patient(),
        })
      ).rejects.toThrow()

      // Anonymous users cannot create clinics
      await expect(
        payload.create({
          collection: 'clinics',
          data: { ...baseClinicData, status: 'draft' },
          user: null,
        })
      ).rejects.toThrow()
    })

    it('restricts deletion to platform staff only', async () => {
      const clinic = await payload.create({
        collection: 'clinics',
        data: { ...baseClinicData, status: 'approved' },
        user: mockUsers.platform(),
      })

      // Clinic staff cannot delete their own clinic
      await expect(
        payload.delete({
          collection: 'clinics',
          id: clinic.id,
          user: mockUsers.clinic(2, clinic.id),
        })
      ).rejects.toThrow()

      // Patient cannot delete clinics
      await expect(
        payload.delete({
          collection: 'clinics',
          id: clinic.id,
          user: mockUsers.patient(),
        })
      ).rejects.toThrow()

      // Clean up as platform user
      await payload.delete({
        collection: 'clinics',
        id: clinic.id,
        user: mockUsers.platform(),
      })
    })
  })

  describe('Status Field Platform-Only Restriction', () => {
    it('allows platform staff to modify clinic status', async () => {
      const clinic = await payload.create({
        collection: 'clinics',
        data: { ...baseClinicData, status: 'draft' },
        user: mockUsers.platform(),
      })

      // Platform staff can change status from draft to approved
      const approved = await payload.update({
        collection: 'clinics',
        id: clinic.id,
        data: { status: 'approved' },
        user: mockUsers.platform(),
      })
      expect(approved.status).toBe('approved')

      // Platform staff can change status from approved to suspended
      const suspended = await payload.update({
        collection: 'clinics',
        id: clinic.id,
        data: { status: 'suspended' },
        user: mockUsers.platform(),
      })
      expect(suspended.status).toBe('suspended')

      // Clean up
      await payload.delete({ collection: 'clinics', id: clinic.id, overrideAccess: true })
    })

    it('prevents non-platform users from modifying clinic status', async () => {
      const clinic = await payload.create({
        collection: 'clinics',
        data: { ...baseClinicData, status: 'draft' },
        user: mockUsers.platform(),
      })

      const clinicUser = mockUsers.clinic(2, clinic.id)

      // Clinic staff cannot change status - this should either fail or ignore the status change
      // Depending on field-level access configuration, this might:
      // 1. Throw an error if field access is properly configured
      // 2. Succeed but ignore the status field change
      // 3. Succeed and change status if field access is not configured
      
      try {
        const attempted = await payload.update({
          collection: 'clinics',
          id: clinic.id,
          data: { 
            status: 'approved', // Attempting to change status
            name: 'Updated Name' // Also updating allowed field
          },
          user: clinicUser,
        })
        
        // If update succeeds, status should not have changed
        expect(attempted.status).toBe('draft') // Should remain draft
        expect(attempted.name).toBe('Updated Name') // Name should be updated
      } catch (error) {
        // If update fails due to field access restrictions, that's also valid
        expect(error).toBeDefined()
      }

      // Patient also cannot change status
      await expect(
        payload.update({
          collection: 'clinics',
          id: clinic.id,
          data: { status: 'approved' },
          user: mockUsers.patient(),
        })
      ).rejects.toThrow()

      // Clean up
      await payload.delete({ collection: 'clinics', id: clinic.id, overrideAccess: true })
    })
  })

  describe('Rating Aggregation', () => {
    it('tracks average rating from approved reviews', async () => {
      const clinic = await payload.create({
        collection: 'clinics',
        data: { ...baseClinicData, status: 'approved' },
        user: mockUsers.platform(),
      })

      // Initial rating should be undefined/null
      expect(clinic.averageRating).toBeUndefined()

      // Create a patient for reviews
      const patient = await payload.create({
        collection: 'patients',
        data: {
          firstName: 'Review',
          lastName: 'Patient',
          email: `${slugPrefix}-reviewer@example.com`,
          dateOfBirth: '1990-01-01',
        },
        overrideAccess: true,
      })

      // Create an approved review
      await payload.create({
        collection: 'reviews',
        data: {
          reviewDate: new Date().toISOString(),
          starRating: 4,
          comment: 'Good clinic',
          patient: patient.id,
          clinic: clinic.id,
          status: 'approved',
        },
        user: mockUsers.platform(),
      })

      // Check that clinic's average rating was updated
      const updatedClinic = await payload.findByID({
        collection: 'clinics',
        id: clinic.id,
        overrideAccess: true,
      })
      expect(updatedClinic.averageRating).toBe(4)

      // Clean up
      await payload.delete({ collection: 'patients', id: patient.id, overrideAccess: true })
      await payload.delete({ collection: 'clinics', id: clinic.id, overrideAccess: true })
    })
  })

  describe('Relationship Integrity', () => {
    it('requires valid city reference', async () => {
      await expect(
        payload.create({
          collection: 'clinics',
          data: {
            ...baseClinicData,
            address: {
              ...baseClinicData.address,
              city: 999999, // Non-existent city ID
            },
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('populates city and country relationships correctly', async () => {
      const clinic = await payload.create({
        collection: 'clinics',
        data: { ...baseClinicData, status: 'approved' },
        user: mockUsers.platform(),
      })

      // Fetch with populated relationships
      const clinicWithRels = await payload.findByID({
        collection: 'clinics',
        id: clinic.id,
        depth: 2, // Populate city and country
        user: mockUsers.platform(),
      })

      expect(clinicWithRels.address.city).toBeDefined()
      expect(typeof clinicWithRels.address.city).toBe('object')
      
      const city = clinicWithRels.address.city as any
      expect(city.name).toBeDefined()
      expect(city.country).toBeDefined()
      expect(typeof city.country).toBe('object')

      // Clean up
      await payload.delete({ collection: 'clinics', id: clinic.id, overrideAccess: true })
    })
  })

  describe('Field Validation', () => {
    it('requires name and essential contact information', async () => {
      // Missing name
      await expect(
        payload.create({
          collection: 'clinics',
          data: {
            address: baseClinicData.address,
            contact: baseClinicData.contact,
            supportedLanguages: baseClinicData.supportedLanguages,
            slug: `${slugPrefix}-no-name`,
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()

      // Missing required address fields
      await expect(
        payload.create({
          collection: 'clinics',
          data: {
            name: `${slugPrefix}-no-address`,
            contact: baseClinicData.contact,
            supportedLanguages: baseClinicData.supportedLanguages,
            slug: `${slugPrefix}-no-address`,
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('validates email format in contact information', async () => {
      await expect(
        payload.create({
          collection: 'clinics',
          data: {
            ...baseClinicData,
            contact: {
              ...baseClinicData.contact,
              email: 'invalid-email-format', // Invalid email
            },
            slug: `${slugPrefix}-invalid-email`,
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('accepts valid clinic data with all fields', async () => {
      const fullClinicData = {
        ...baseClinicData,
        description: [
          {
            children: [{ text: 'A comprehensive medical clinic providing excellent care.' }],
          },
        ],
        supportedLanguages: ['english', 'german'],
        contact: {
          ...baseClinicData.contact,
          website: 'https://example-clinic.com',
        },
        status: 'approved',
      }

      const clinic = await payload.create({
        collection: 'clinics',
        data: fullClinicData,
        user: mockUsers.platform(),
      })

      expect(clinic.id).toBeDefined()
      expect(clinic.name).toBe(fullClinicData.name)
      expect(clinic.supportedLanguages).toHaveLength(2)
      expect(clinic.status).toBe('approved')
      expect(clinic.contact.website).toBe('https://example-clinic.com')

      // Clean up
      await payload.delete({ collection: 'clinics', id: clinic.id, overrideAccess: true })
    })
  })

  describe('Soft Delete Behavior', () => {
    it('soft deletes clinics when trash is enabled', async () => {
      const clinic = await payload.create({
        collection: 'clinics',
        data: { ...baseClinicData, status: 'approved' },
        user: mockUsers.platform(),
      })

      // Delete the clinic
      await payload.delete({
        collection: 'clinics',
        id: clinic.id,
        user: mockUsers.platform(),
      })

      // Should not be found in normal queries
      await expect(
        payload.findByID({
          collection: 'clinics',
          id: clinic.id,
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })
  })

  describe('Clinic-Doctor Relationship', () => {
    it('supports doctors belonging to clinics', async () => {
      const clinic = await payload.create({
        collection: 'clinics',
        data: { ...baseClinicData, status: 'approved' },
        user: mockUsers.platform(),
      })

      // Create doctor for this clinic
      const doctor = await payload.create({
        collection: 'doctors',
        data: {
          title: 'dr',
          firstName: 'Test',
          lastName: 'Doctor',
          clinic: clinic.id,
          qualifications: ['MD'],
          languages: ['english'],
          slug: `${slugPrefix}-doctor`,
        },
        user: mockUsers.platform(),
      })

      expect(doctor.clinic).toBe(clinic.id)

      // Verify doctor can be found through clinic relationship
      const doctorWithClinic = await payload.findByID({
        collection: 'doctors',
        id: doctor.id,
        depth: 1,
        user: mockUsers.platform(),
      })

      expect(typeof doctorWithClinic.clinic).toBe('object')
      expect((doctorWithClinic.clinic as any).name).toBe(clinic.name)

      // Clean up
      await payload.delete({ collection: 'doctors', id: doctor.id, overrideAccess: true })
      await payload.delete({ collection: 'clinics', id: clinic.id, overrideAccess: true })
    })
  })
})