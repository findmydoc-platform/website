import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { mockUsers } from '../unit/helpers/mockUsers'

describe('Doctors Integration Tests', () => {
  let payload: Payload
  const slugPrefix = testSlug('doctors.integration.test.ts')
  let testClinic: any
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

    // Create a test clinic for doctor relationships
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
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
  })

  describe('Access Control Matrix', () => {
    const testDoctor = {
      title: 'dr',
      firstName: 'John',
      lastName: 'Doe',
      clinic: testClinic.id,
      qualifications: ['MD'],
      languages: ['english'],
      slug: `${slugPrefix}-john-doe`,
    }

    it('allows public read access for all users', async () => {
      // Create doctor as platform user
      const created = await payload.create({
        collection: 'doctors',
        data: testDoctor,
        user: mockUsers.platform(),
      })

      // Anonymous can read
      const readAsAnonymous = await payload.findByID({
        collection: 'doctors',
        id: created.id,
        user: null,
      })
      expect(readAsAnonymous.id).toBe(created.id)

      // Clinic staff can read
      const readAsClinic = await payload.findByID({
        collection: 'doctors',
        id: created.id,
        user: mockUsers.clinic(),
      })
      expect(readAsClinic.id).toBe(created.id)

      // Patient can read
      const readAsPatient = await payload.findByID({
        collection: 'doctors',
        id: created.id,
        user: mockUsers.patient(),
      })
      expect(readAsPatient.id).toBe(created.id)
    })

    it('allows platform staff full CRUD access', async () => {
      // Platform staff can create
      const created = await payload.create({
        collection: 'doctors',
        data: testDoctor,
        user: mockUsers.platform(),
      })
      expect(created.id).toBeDefined()
      expect(created.firstName).toBe(testDoctor.firstName)

      // Platform staff can update
      const updated = await payload.update({
        collection: 'doctors',
        id: created.id,
        data: { firstName: 'Jane' },
        user: mockUsers.platform(),
      })
      expect(updated.firstName).toBe('Jane')

      // Platform staff can delete
      await payload.delete({
        collection: 'doctors',
        id: created.id,
        user: mockUsers.platform(),
      })
    })

    it('allows clinic staff scoped access to their clinic doctors', async () => {
      // Create clinic staff user with specific clinic assignment
      const clinicUser = mockUsers.clinic(2, testClinic.id)

      // Clinic staff can create doctors for their clinic
      const created = await payload.create({
        collection: 'doctors',
        data: testDoctor,
        user: clinicUser,
      })
      expect(created.id).toBeDefined()

      // Clinic staff can update their clinic's doctors
      const updated = await payload.update({
        collection: 'doctors',
        id: created.id,
        data: { firstName: 'Updated' },
        user: clinicUser,
      })
      expect(updated.firstName).toBe('Updated')

      // Clean up
      await payload.delete({
        collection: 'doctors',
        id: created.id,
        overrideAccess: true,
      })
    })

    it('denies creation and modification for non-authorized users', async () => {
      // Patient cannot create doctors
      await expect(
        payload.create({
          collection: 'doctors',
          data: testDoctor,
          user: mockUsers.patient(),
        })
      ).rejects.toThrow()

      // Anonymous cannot create doctors
      await expect(
        payload.create({
          collection: 'doctors',
          data: testDoctor,
          user: null,
        })
      ).rejects.toThrow()

      // Create doctor first to test updates
      const created = await payload.create({
        collection: 'doctors',
        data: testDoctor,
        user: mockUsers.platform(),
      })

      // Patient cannot update doctors
      await expect(
        payload.update({
          collection: 'doctors',
          id: created.id,
          data: { firstName: 'Unauthorized' },
          user: mockUsers.patient(),
        })
      ).rejects.toThrow()

      // Patient cannot delete doctors  
      await expect(
        payload.delete({
          collection: 'doctors',
          id: created.id,
          user: mockUsers.patient(),
        })
      ).rejects.toThrow()

      // Clean up
      await payload.delete({
        collection: 'doctors',
        id: created.id,
        overrideAccess: true,
      })
    })

    it('restricts deletion to platform staff only', async () => {
      const created = await payload.create({
        collection: 'doctors',
        data: testDoctor,
        user: mockUsers.platform(),
      })

      // Clinic staff cannot delete
      await expect(
        payload.delete({
          collection: 'doctors',
          id: created.id,
          user: mockUsers.clinic(),
        })
      ).rejects.toThrow()

      // Clean up as platform user
      await payload.delete({
        collection: 'doctors',
        id: created.id,
        user: mockUsers.platform(),
      })
    })
  })

  describe('Derived Field Computation - fullName Hook', () => {
    it('generates fullName from title, firstName, and lastName on create', async () => {
      const doctor = await payload.create({
        collection: 'doctors',
        data: {
          title: 'prof_dr',
          firstName: 'Maria',
          lastName: 'Smith',
          clinic: testClinic.id,
          qualifications: ['MD', 'PhD'],
          languages: ['english'],
          slug: `${slugPrefix}-maria-smith`,
        },
        user: mockUsers.platform(),
      })

      expect(doctor.fullName).toBe('Prof. Dr. Maria Smith')
    })

    it('updates fullName when name fields change', async () => {
      const doctor = await payload.create({
        collection: 'doctors',
        data: {
          title: 'dr',
          firstName: 'John',
          lastName: 'Doe',
          clinic: testClinic.id,
          qualifications: ['MD'],
          languages: ['english'],
          slug: `${slugPrefix}-john-initial`,
        },
        user: mockUsers.platform(),
      })

      expect(doctor.fullName).toBe('Dr. John Doe')

      // Update the names
      const updated = await payload.update({
        collection: 'doctors',
        id: doctor.id,
        data: {
          title: 'specialist',
          firstName: 'Jane',
          lastName: 'Smith',
        },
        user: mockUsers.platform(),
      })

      expect(updated.fullName).toBe('Specialist Dr. Jane Smith')
    })

    it('handles missing or null name components gracefully', async () => {
      const doctor = await payload.create({
        collection: 'doctors',
        data: {
          firstName: 'OnlyFirst',
          lastName: 'OnlyLast',
          clinic: testClinic.id,
          qualifications: ['MD'],
          languages: ['english'],
          slug: `${slugPrefix}-partial-name`,
        },
        user: mockUsers.platform(),
      })

      expect(doctor.fullName).toBe('OnlyFirst OnlyLast')
    })

    it('handles various title formats correctly', async () => {
      const testCases = [
        { title: 'dr', expected: 'Dr.' },
        { title: 'specialist', expected: 'Specialist Dr.' },
        { title: 'surgeon', expected: 'Surgeon Dr.' },
        { title: 'assoc_prof', expected: 'Assoc. Prof. Dr.' },
        { title: 'prof_dr', expected: 'Prof. Dr.' },
      ]

      for (const testCase of testCases) {
        const doctor = await payload.create({
          collection: 'doctors',
          data: {
            title: testCase.title,
            firstName: 'Test',
            lastName: 'Doctor',
            clinic: testClinic.id,
            qualifications: ['MD'],
            languages: ['english'],
            slug: `${slugPrefix}-title-${testCase.title}`,
          },
          user: mockUsers.platform(),
        })

        expect(doctor.fullName).toBe(`${testCase.expected} Test Doctor`)

        // Clean up individual test case
        await payload.delete({
          collection: 'doctors',
          id: doctor.id,
          overrideAccess: true,
        })
      }
    })
  })

  describe('Relationship Integrity', () => {
    it('requires valid clinic reference', async () => {
      await expect(
        payload.create({
          collection: 'doctors',
          data: {
            title: 'dr',
            firstName: 'Test',
            lastName: 'Doctor',
            clinic: 999999, // Non-existent clinic ID
            qualifications: ['MD'],
            languages: ['english'],
            slug: `${slugPrefix}-invalid-clinic`,
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('populates clinic relationship correctly', async () => {
      const doctor = await payload.create({
        collection: 'doctors',
        data: {
          title: 'dr',
          firstName: 'Test',
          lastName: 'Doctor',
          clinic: testClinic.id,
          qualifications: ['MD'],
          languages: ['english'],
          slug: `${slugPrefix}-with-clinic`,
        },
        user: mockUsers.platform(),
      })

      // Fetch with populated clinic
      const doctorWithClinic = await payload.findByID({
        collection: 'doctors',
        id: doctor.id,
        depth: 1,
        user: mockUsers.platform(),
      })

      expect(doctorWithClinic.clinic).toBeDefined()
      expect(typeof doctorWithClinic.clinic).toBe('object')
      expect((doctorWithClinic.clinic as any).name).toBe(testClinic.name)
    })
  })

  describe('Field Validation', () => {
    it('requires firstName and lastName', async () => {
      await expect(
        payload.create({
          collection: 'doctors',
          data: {
            title: 'dr',
            clinic: testClinic.id,
            qualifications: ['MD'],
            languages: ['english'],
            slug: `${slugPrefix}-missing-names`,
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('accepts valid qualification and language arrays', async () => {
      const doctor = await payload.create({
        collection: 'doctors',
        data: {
          title: 'dr',
          firstName: 'Multi',
          lastName: 'Qualified',
          clinic: testClinic.id,
          qualifications: ['MD', 'PhD', 'MRCP'],
          languages: ['english', 'german', 'spanish'],
          slug: `${slugPrefix}-multi-qualified`,
        },
        user: mockUsers.platform(),
      })

      expect(doctor.qualifications).toHaveLength(3)
      expect(doctor.languages).toHaveLength(3)
      expect(doctor.qualifications).toContain('MD')
      expect(doctor.languages).toContain('english')
    })
  })

  describe('Soft Delete Behavior', () => {
    it('soft deletes doctors when trash is enabled', async () => {
      const doctor = await payload.create({
        collection: 'doctors',
        data: {
          title: 'dr',
          firstName: 'Soft',
          lastName: 'Delete',
          clinic: testClinic.id,
          qualifications: ['MD'],
          languages: ['english'],
          slug: `${slugPrefix}-soft-delete`,
        },
        user: mockUsers.platform(),
      })

      // Delete the doctor
      await payload.delete({
        collection: 'doctors',
        id: doctor.id,
        user: mockUsers.platform(),
      })

      // Should not be found in normal queries
      await expect(
        payload.findByID({
          collection: 'doctors',
          id: doctor.id,
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })
  })
})