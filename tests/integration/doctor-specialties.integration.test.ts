import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { mockUsers } from '../unit/helpers/mockUsers'

describe('Doctor Specialties Join Integration Tests', () => {
  let payload: Payload
  const slugPrefix = testSlug('doctor-specialties.integration.test.ts')
  let testClinic: any
  let testDoctor: any
  let testSpecialty: any
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
        firstName: 'Specialty',
        lastName: 'Doctor',
        clinic: testClinic.id,
        qualifications: ['MD'],
        languages: ['english'],
        slug: `${slugPrefix}-doctor`,
      },
      overrideAccess: true,
    })

    // Get or create test specialty
    const specialties = await payload.find({
      collection: 'medical-specialties',
      limit: 1,
      overrideAccess: true,
    })

    if (specialties.docs.length > 0) {
      testSpecialty = specialties.docs[0]
    } else {
      testSpecialty = await payload.create({
        collection: 'medical-specialties',
        data: {
          name: `${slugPrefix}-cardiology`,
          description: 'Heart and blood vessel conditions',
        },
        overrideAccess: true,
      })
    }
  })

  afterEach(async () => {
    // Clean up doctor specialties
    const { docs } = await payload.find({
      collection: 'doctorspecialties',
      where: {
        or: [
          { doctor: { equals: testDoctor.id } },
          { medicalSpecialty: { equals: testSpecialty.id } }
        ]
      },
      limit: 100,
      overrideAccess: true,
    })
    
    for (const doc of docs) {
      await payload.delete({ 
        collection: 'doctorspecialties', 
        id: doc.id, 
        overrideAccess: true 
      })
    }
  })

  describe('Access Control Matrix', () => {
    const doctorSpecialtyData = {
      doctor: testDoctor.id,
      medicalSpecialty: testSpecialty.id,
      specializationLevel: 'intermediate',
      certifications: [
        { certification: 'Board Certified in Cardiology' }
      ],
    }

    it('allows public read access for all users', async () => {
      // Create doctor specialty as platform user
      const created = await payload.create({
        collection: 'doctorspecialties',
        data: doctorSpecialtyData,
        user: mockUsers.platform(),
      })

      // Anonymous can read
      const readAsAnonymous = await payload.findByID({
        collection: 'doctorspecialties',
        id: created.id,
        user: null,
      })
      expect(readAsAnonymous.id).toBe(created.id)

      // Clinic staff can read
      const readAsClinic = await payload.findByID({
        collection: 'doctorspecialties',
        id: created.id,
        user: mockUsers.clinic(),
      })
      expect(readAsClinic.id).toBe(created.id)

      // Patient can read
      const readAsPatient = await payload.findByID({
        collection: 'doctorspecialties',
        id: created.id,
        user: mockUsers.patient(),
      })
      expect(readAsPatient.id).toBe(created.id)
    })

    it('allows platform staff full CRUD access', async () => {
      // Platform staff can create
      const created = await payload.create({
        collection: 'doctorspecialties',
        data: doctorSpecialtyData,
        user: mockUsers.platform(),
      })
      expect(created.id).toBeDefined()
      expect(created.specializationLevel).toBe('intermediate')

      // Platform staff can update
      const updated = await payload.update({
        collection: 'doctorspecialties',
        id: created.id,
        data: { specializationLevel: 'advanced' },
        user: mockUsers.platform(),
      })
      expect(updated.specializationLevel).toBe('advanced')

      // Platform staff can delete
      await payload.delete({
        collection: 'doctorspecialties',
        id: created.id,
        user: mockUsers.platform(),
      })
    })

    it('allows clinic staff scoped access to their clinic doctors', async () => {
      // Create clinic staff user assigned to test clinic
      const clinicUser = mockUsers.clinic(2, testClinic.id)

      // Clinic staff can create specialties for their clinic's doctors
      const created = await payload.create({
        collection: 'doctorspecialties',
        data: doctorSpecialtyData,
        user: clinicUser,
      })
      expect(created.id).toBeDefined()
      expect(created.doctor).toBe(testDoctor.id)

      // Clinic staff can update their clinic doctor's specialties
      const updated = await payload.update({
        collection: 'doctorspecialties',
        id: created.id,
        data: { specializationLevel: 'expert' },
        user: clinicUser,
      })
      expect(updated.specializationLevel).toBe('expert')

      // Clean up
      await payload.delete({
        collection: 'doctorspecialties',
        id: created.id,
        overrideAccess: true,
      })
    })

    it('prevents clinic staff from accessing other clinics doctors', async () => {
      // Create another clinic and doctor
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

      const otherDoctor = await payload.create({
        collection: 'doctors',
        data: {
          title: 'dr',
          firstName: 'Other',
          lastName: 'Doctor',
          clinic: otherClinic.id,
          qualifications: ['MD'],
          languages: ['english'],
          slug: `${slugPrefix}-other-doctor`,
        },
        overrideAccess: true,
      })

      // Create specialty for other clinic's doctor as platform user
      const otherDoctorSpecialty = await payload.create({
        collection: 'doctorspecialties',
        data: {
          doctor: otherDoctor.id,
          medicalSpecialty: testSpecialty.id,
          specializationLevel: 'beginner',
        },
        user: mockUsers.platform(),
      })

      // Clinic staff from testClinic should not be able to update other clinic's doctor specialty
      const clinicUser = mockUsers.clinic(2, testClinic.id)
      
      await expect(
        payload.update({
          collection: 'doctorspecialties',
          id: otherDoctorSpecialty.id,
          data: { specializationLevel: 'advanced' },
          user: clinicUser,
        })
      ).rejects.toThrow()

      // Clean up
      await payload.delete({ collection: 'doctorspecialties', id: otherDoctorSpecialty.id, overrideAccess: true })
      await payload.delete({ collection: 'doctors', id: otherDoctor.id, overrideAccess: true })
      await payload.delete({ collection: 'clinics', id: otherClinic.id, overrideAccess: true })
    })

    it('restricts deletion to platform staff only', async () => {
      const created = await payload.create({
        collection: 'doctorspecialties',
        data: doctorSpecialtyData,
        user: mockUsers.platform(),
      })

      // Clinic staff cannot delete
      await expect(
        payload.delete({
          collection: 'doctorspecialties',
          id: created.id,
          user: mockUsers.clinic(2, testClinic.id),
        })
      ).rejects.toThrow()

      // Patient cannot delete
      await expect(
        payload.delete({
          collection: 'doctorspecialties',
          id: created.id,
          user: mockUsers.patient(),
        })
      ).rejects.toThrow()

      // Clean up as platform user
      await payload.delete({
        collection: 'doctorspecialties',
        id: created.id,
        user: mockUsers.platform(),
      })
    })

    it('denies creation for unauthorized users', async () => {
      // Patient cannot create doctor specialties
      await expect(
        payload.create({
          collection: 'doctorspecialties',
          data: doctorSpecialtyData,
          user: mockUsers.patient(),
        })
      ).rejects.toThrow()

      // Anonymous users cannot create doctor specialties
      await expect(
        payload.create({
          collection: 'doctorspecialties',
          data: doctorSpecialtyData,
          user: null,
        })
      ).rejects.toThrow()
    })
  })

  describe('Relationship Integrity', () => {
    it('requires valid doctor reference', async () => {
      await expect(
        payload.create({
          collection: 'doctorspecialties',
          data: {
            doctor: 999999, // Non-existent doctor ID
            medicalSpecialty: testSpecialty.id,
            specializationLevel: 'beginner',
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('requires valid medical specialty reference', async () => {
      await expect(
        payload.create({
          collection: 'doctorspecialties',
          data: {
            doctor: testDoctor.id,
            medicalSpecialty: 999999, // Non-existent specialty ID
            specializationLevel: 'beginner',
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('populates doctor and specialty relationships correctly', async () => {
      const doctorSpecialty = await payload.create({
        collection: 'doctorspecialties',
        data: {
          doctor: testDoctor.id,
          medicalSpecialty: testSpecialty.id,
          specializationLevel: 'advanced',
          certifications: [
            { certification: 'Board Certified' },
            { certification: 'Fellowship Trained' }
          ],
        },
        user: mockUsers.platform(),
      })

      // Fetch with populated relationships
      const populated = await payload.findByID({
        collection: 'doctorspecialties',
        id: doctorSpecialty.id,
        depth: 1,
        user: mockUsers.platform(),
      })

      expect(populated.doctor).toBeDefined()
      expect(populated.medicalSpecialty).toBeDefined()

      if (typeof populated.doctor === 'object') {
        expect((populated.doctor as any).firstName).toBe('Specialty')
        expect((populated.doctor as any).lastName).toBe('Doctor')
      }

      if (typeof populated.medicalSpecialty === 'object') {
        expect((populated.medicalSpecialty as any).name).toBeDefined()
      }
    })

    it('enforces unique doctor-specialty combinations', async () => {
      const doctorSpecialtyData = {
        doctor: testDoctor.id,
        medicalSpecialty: testSpecialty.id,
        specializationLevel: 'intermediate',
      }

      // Create first doctor specialty
      const first = await payload.create({
        collection: 'doctorspecialties',
        data: doctorSpecialtyData,
        user: mockUsers.platform(),
      })

      // Attempt to create duplicate should fail due to unique index
      await expect(
        payload.create({
          collection: 'doctorspecialties',
          data: {
            ...doctorSpecialtyData,
            specializationLevel: 'expert', // Different level, but same doctor-specialty combination
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()

      // Clean up
      await payload.delete({
        collection: 'doctorspecialties',
        id: first.id,
        overrideAccess: true,
      })
    })
  })

  describe('Field Validation', () => {
    it('requires doctor, medicalSpecialty, and specializationLevel fields', async () => {
      // Missing doctor
      await expect(
        payload.create({
          collection: 'doctorspecialties',
          data: {
            medicalSpecialty: testSpecialty.id,
            specializationLevel: 'beginner',
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()

      // Missing medicalSpecialty
      await expect(
        payload.create({
          collection: 'doctorspecialties',
          data: {
            doctor: testDoctor.id,
            specializationLevel: 'beginner',
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()

      // Missing specializationLevel
      await expect(
        payload.create({
          collection: 'doctorspecialties',
          data: {
            doctor: testDoctor.id,
            medicalSpecialty: testSpecialty.id,
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('validates specializationLevel options', async () => {
      // Valid specialization levels
      const validLevels = ['beginner', 'intermediate', 'advanced', 'expert', 'specialist']

      for (const level of validLevels) {
        const doctorSpecialty = await payload.create({
          collection: 'doctorspecialties',
          data: {
            doctor: testDoctor.id,
            medicalSpecialty: testSpecialty.id,
            specializationLevel: level,
          },
          user: mockUsers.platform(),
        })

        expect(doctorSpecialty.specializationLevel).toBe(level)

        // Clean up immediately
        await payload.delete({
          collection: 'doctorspecialties',
          id: doctorSpecialty.id,
          overrideAccess: true,
        })
      }

      // Invalid specialization level should fail
      await expect(
        payload.create({
          collection: 'doctorspecialties',
          data: {
            doctor: testDoctor.id,
            medicalSpecialty: testSpecialty.id,
            specializationLevel: 'invalid_level',
          },
          user: mockUsers.platform(),
        })
      ).rejects.toThrow()
    })

    it('accepts optional certifications array', async () => {
      const doctorSpecialty = await payload.create({
        collection: 'doctorspecialties',
        data: {
          doctor: testDoctor.id,
          medicalSpecialty: testSpecialty.id,
          specializationLevel: 'expert',
          certifications: [
            { certification: 'Board Certified in Cardiology' },
            { certification: 'Fellow of the American College of Cardiology' },
            { certification: 'Interventional Cardiology Certificate' }
          ],
        },
        user: mockUsers.platform(),
      })

      expect(doctorSpecialty.certifications).toHaveLength(3)
      expect(doctorSpecialty.certifications[0].certification).toBe('Board Certified in Cardiology')
    })
  })

  describe('Query and Filtering', () => {
    it('supports querying specialties by doctor', async () => {
      // Create multiple specialties for the same doctor
      const cardiology = await payload.create({
        collection: 'doctorspecialties',
        data: {
          doctor: testDoctor.id,
          medicalSpecialty: testSpecialty.id,
          specializationLevel: 'expert',
        },
        user: mockUsers.platform(),
      })

      // Find specialties for specific doctor
      const results = await payload.find({
        collection: 'doctorspecialties',
        where: { doctor: { equals: testDoctor.id } },
        user: mockUsers.platform(),
      })

      expect(results.docs.length).toBeGreaterThan(0)
      expect(results.docs[0].doctor).toBe(testDoctor.id)

      // Clean up
      await payload.delete({ collection: 'doctorspecialties', id: cardiology.id, overrideAccess: true })
    })

    it('supports querying doctors by specialty', async () => {
      // Create doctor specialty
      const doctorSpecialty = await payload.create({
        collection: 'doctorspecialties',
        data: {
          doctor: testDoctor.id,
          medicalSpecialty: testSpecialty.id,
          specializationLevel: 'advanced',
        },
        user: mockUsers.platform(),
      })

      // Find doctors with specific specialty
      const results = await payload.find({
        collection: 'doctorspecialties',
        where: { medicalSpecialty: { equals: testSpecialty.id } },
        user: mockUsers.platform(),
      })

      expect(results.docs.length).toBeGreaterThan(0)
      expect(results.docs[0].medicalSpecialty).toBe(testSpecialty.id)

      // Clean up
      await payload.delete({ collection: 'doctorspecialties', id: doctorSpecialty.id, overrideAccess: true })
    })

    it('supports filtering by specialization level', async () => {
      // Create doctor specialties with different levels
      const beginner = await payload.create({
        collection: 'doctorspecialties',
        data: {
          doctor: testDoctor.id,
          medicalSpecialty: testSpecialty.id,
          specializationLevel: 'beginner',
        },
        user: mockUsers.platform(),
      })

      // Query for specific specialization levels
      const expertResults = await payload.find({
        collection: 'doctorspecialties',
        where: { specializationLevel: { equals: 'expert' } },
        user: mockUsers.platform(),
      })

      const beginnerResults = await payload.find({
        collection: 'doctorspecialties',
        where: { specializationLevel: { equals: 'beginner' } },
        user: mockUsers.platform(),
      })

      expect(beginnerResults.docs.length).toBeGreaterThan(0)
      beginnerResults.docs.forEach(doc => {
        expect(doc.specializationLevel).toBe('beginner')
      })

      // Clean up
      await payload.delete({ collection: 'doctorspecialties', id: beginner.id, overrideAccess: true })
    })
  })

  describe('Doctor Specialty Linkage', () => {
    it('enables many-to-many relationship between doctors and specialties', async () => {
      // One doctor can have multiple specialties
      const specialty1 = testSpecialty
      
      // Try to get another specialty or create one
      let specialty2: any
      const specialties = await payload.find({
        collection: 'medical-specialties',
        where: { id: { not_equals: specialty1.id } },
        limit: 1,
        overrideAccess: true,
      })

      if (specialties.docs.length > 0) {
        specialty2 = specialties.docs[0]
      } else {
        specialty2 = await payload.create({
          collection: 'medical-specialties',
          data: {
            name: `${slugPrefix}-neurology`,
            description: 'Nervous system conditions',
          },
          overrideAccess: true,
        })
      }

      // Create two specialties for the same doctor
      const ds1 = await payload.create({
        collection: 'doctorspecialties',
        data: {
          doctor: testDoctor.id,
          medicalSpecialty: specialty1.id,
          specializationLevel: 'expert',
        },
        user: mockUsers.platform(),
      })

      const ds2 = await payload.create({
        collection: 'doctorspecialties',
        data: {
          doctor: testDoctor.id,
          medicalSpecialty: specialty2.id,
          specializationLevel: 'intermediate',
        },
        user: mockUsers.platform(),
      })

      // Verify doctor has multiple specialties
      const doctorSpecialties = await payload.find({
        collection: 'doctorspecialties',
        where: { doctor: { equals: testDoctor.id } },
        user: mockUsers.platform(),
      })

      expect(doctorSpecialties.docs.length).toBeGreaterThanOrEqual(2)

      // Clean up
      await payload.delete({ collection: 'doctorspecialties', id: ds1.id, overrideAccess: true })
      await payload.delete({ collection: 'doctorspecialties', id: ds2.id, overrideAccess: true })
      
      // Clean up test specialty if we created it
      if (specialty2.name?.includes(slugPrefix)) {
        await payload.delete({ 
          collection: 'medical-specialties', 
          id: specialty2.id, 
          overrideAccess: true 
        })
      }
    })
  })
})