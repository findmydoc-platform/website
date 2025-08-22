import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'

describe('FavoriteClinics API and Data Integrity Tests', () => {
  let payload: Payload
  const slugPrefix = testSlug('favorite-clinics.test.ts')
  let cities: any[] = []
  let clinics: any[] = []
  let patients: any[] = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    // Get a city for clinic creation
    const res = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    cities = res.docs

    // Create test clinics
    const clinic1 = await createClinicFixture(payload, cities[0]!.id as number, {
      slugPrefix: `${slugPrefix}-clinic1`,
    })
    const clinic2 = await createClinicFixture(payload, cities[0]!.id as number, {
      slugPrefix: `${slugPrefix}-clinic2`,
    })
    clinics = [clinic1.clinic, clinic2.clinic]

    // Create test patients
    const patient1 = await payload.create({
      collection: 'patients',
      data: {
        email: `${slugPrefix}-patient1@test.com`,
        supabaseUserId: `${slugPrefix}-patient1-supabase`,
        firstName: 'Test',
        lastName: 'Patient1',
      },
      overrideAccess: true,
    })

    const patient2 = await payload.create({
      collection: 'patients',
      data: {
        email: `${slugPrefix}-patient2@test.com`,
        supabaseUserId: `${slugPrefix}-patient2-supabase`,
        firstName: 'Test',
        lastName: 'Patient2',
      },
      overrideAccess: true,
    })
    patients = [patient1, patient2]
  })

  beforeEach(async () => {
    // Clean up any existing favorites before each test
    const favorites = await payload.find({
      collection: 'favoriteclinics',
      overrideAccess: true,
    })

    for (const favorite of favorites.docs) {
      try {
        await payload.delete({
          collection: 'favoriteclinics',
          id: favorite.id,
          overrideAccess: true,
        })
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  })

  afterAll(async () => {
    // Clean up test entities
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
    await cleanupTestEntities(payload, 'doctors', slugPrefix)

    // Clean up users
    for (const patient of patients) {
      try {
        await payload.delete({ collection: 'patients', id: patient.id, overrideAccess: true })
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  })

  describe('Data Integrity and Business Logic', () => {
    it('should create favorite clinic successfully', async () => {
      const result = await payload.create({
        collection: 'favoriteclinics',
        data: {
          patient: patients[0]!.id,
          clinic: clinics[0]!.id,
        },
        overrideAccess: true,
      })

      expect(result.id).toBeDefined()
      expect(typeof result.patient === 'object' ? result.patient.id : result.patient).toBe(patients[0]!.id)
      expect(typeof result.clinic === 'object' ? result.clinic.id : result.clinic).toBe(clinics[0]!.id)
      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
    })

    it('should enforce unique patient+clinic combination', async () => {
      // Create first favorite
      const first = await payload.create({
        collection: 'favoriteclinics',
        data: {
          patient: patients[0]!.id,
          clinic: clinics[0]!.id,
        },
        overrideAccess: true,
      })

      expect(first.id).toBeDefined()

      // Try to create duplicate - should fail with unique constraint
      await expect(
        payload.create({
          collection: 'favoriteclinics',
          data: {
            patient: patients[0]!.id,
            clinic: clinics[0]!.id,
          },
          overrideAccess: true,
        }),
      ).rejects.toThrow(/patient_id, clinic_id/)
    })

    it('should allow same clinic to be favorited by different patients', async () => {
      // Patient1 favorites clinic1
      const favorite1 = await payload.create({
        collection: 'favoriteclinics',
        data: {
          patient: patients[0]!.id,
          clinic: clinics[0]!.id,
        },
        overrideAccess: true,
      })

      // Patient2 favorites same clinic - should succeed
      const favorite2 = await payload.create({
        collection: 'favoriteclinics',
        data: {
          patient: patients[1]!.id,
          clinic: clinics[0]!.id,
        },
        overrideAccess: true,
      })

      expect(favorite1.id).toBeDefined()
      expect(favorite2.id).toBeDefined()
      expect(favorite1.id).not.toBe(favorite2.id)
      
      const clinic1Id = typeof favorite1.clinic === 'object' ? favorite1.clinic.id : favorite1.clinic
      const clinic2Id = typeof favorite2.clinic === 'object' ? favorite2.clinic.id : favorite2.clinic
      expect(clinic1Id).toBe(clinic2Id)
      
      const patient1Id = typeof favorite1.patient === 'object' ? favorite1.patient.id : favorite1.patient
      const patient2Id = typeof favorite2.patient === 'object' ? favorite2.patient.id : favorite2.patient
      expect(patient1Id).not.toBe(patient2Id)
    })

    it('should allow same patient to favorite different clinics', async () => {
      // Patient1 favorites clinic1
      const favorite1 = await payload.create({
        collection: 'favoriteclinics',
        data: {
          patient: patients[0]!.id,
          clinic: clinics[0]!.id,
        },
        overrideAccess: true,
      })

      // Same patient favorites clinic2 - should succeed
      const favorite2 = await payload.create({
        collection: 'favoriteclinics',
        data: {
          patient: patients[0]!.id,
          clinic: clinics[1]!.id,
        },
        overrideAccess: true,
      })

      expect(favorite1.id).toBeDefined()
      expect(favorite2.id).toBeDefined()
      expect(favorite1.id).not.toBe(favorite2.id)
      
      const patient1Id = typeof favorite1.patient === 'object' ? favorite1.patient.id : favorite1.patient
      const patient2Id = typeof favorite2.patient === 'object' ? favorite2.patient.id : favorite2.patient
      expect(patient1Id).toBe(patient2Id)
      
      const clinic1Id = typeof favorite1.clinic === 'object' ? favorite1.clinic.id : favorite1.clinic
      const clinic2Id = typeof favorite2.clinic === 'object' ? favorite2.clinic.id : favorite2.clinic
      expect(clinic1Id).not.toBe(clinic2Id)
    })

    it('should update favorite clinic successfully', async () => {
      // Create favorite
      const favorite = await payload.create({
        collection: 'favoriteclinics',
        data: {
          patient: patients[0]!.id,
          clinic: clinics[0]!.id,
        },
        overrideAccess: true,
      })

      // Update clinic to different one
      const updated = await payload.update({
        collection: 'favoriteclinics',
        id: favorite.id,
        data: {
          clinic: clinics[1]!.id,
        },
        overrideAccess: true,
      })

      const updatedClinicId = typeof updated.clinic === 'object' ? updated.clinic.id : updated.clinic
      const updatedPatientId = typeof updated.patient === 'object' ? updated.patient.id : updated.patient
      
      expect(updatedClinicId).toBe(clinics[1]!.id)
      expect(updatedPatientId).toBe(patients[0]!.id) // Should remain the same
      expect(updated.updatedAt).not.toBe(updated.createdAt)
    })

    it('should delete favorite clinic successfully', async () => {
      // Create favorite
      const favorite = await payload.create({
        collection: 'favoriteclinics',
        data: {
          patient: patients[0]!.id,
          clinic: clinics[0]!.id,
        },
        overrideAccess: true,
      })

      // Delete it
      await payload.delete({
        collection: 'favoriteclinics',
        id: favorite.id,
        overrideAccess: true,
      })

      // Verify it's deleted
      const result = await payload.find({
        collection: 'favoriteclinics',
        where: { id: { equals: favorite.id } },
        overrideAccess: true,
      })

      expect(result.docs).toHaveLength(0)
    })

    it('should require patient field', async () => {
      await expect(
        payload.create({
          collection: 'favoriteclinics',
          data: {
            clinic: clinics[0]!.id,
            // Missing patient field - TypeScript error expected, but test should work
          } as any,
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })

    it('should require clinic field', async () => {
      await expect(
        payload.create({
          collection: 'favoriteclinics',
          data: {
            patient: patients[0]!.id,
            // Missing clinic field - TypeScript error expected, but test should work
          } as any,
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })

    it('should validate patient relationship exists', async () => {
      await expect(
        payload.create({
          collection: 'favoriteclinics',
          data: {
            patient: 99999, // Non-existent patient
            clinic: clinics[0]!.id,
          },
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })

    it('should validate clinic relationship exists', async () => {
      await expect(
        payload.create({
          collection: 'favoriteclinics',
          data: {
            patient: patients[0]!.id,
            clinic: 99999, // Non-existent clinic
          },
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })
  })

  describe('Collection Configuration Validation', () => {
    it('should have correct collection configuration', async () => {
      const { FavoriteClinics } = await import('@/collections/FavoriteClinics')

      expect(FavoriteClinics.slug).toBe('favoriteclinics')
      expect(FavoriteClinics.timestamps).toBe(true)
      
      // Check specific fields we care about (there may be additional auto-generated fields)
      const fields = FavoriteClinics.fields
      
      // Check patient field
      const patientField = fields.find((f: any) => f.name === 'patient')
      expect(patientField).toBeDefined()
      expect(patientField!.type).toBe('relationship')
      expect((patientField as any).relationTo).toBe('patients')
      expect((patientField as any).required).toBe(true)

      // Check clinic field
      const clinicField = fields.find((f: any) => f.name === 'clinic')
      expect(clinicField).toBeDefined()
      expect(clinicField!.type).toBe('relationship')
      expect((clinicField as any).relationTo).toBe('clinics')
      expect((clinicField as any).required).toBe(true)
    })

    it('should have unique index on patient+clinic', async () => {
      const { FavoriteClinics } = await import('@/collections/FavoriteClinics')

      expect(FavoriteClinics.indexes).toBeDefined()
      expect(FavoriteClinics.indexes).toHaveLength(1)
      expect(FavoriteClinics.indexes![0]!.fields).toEqual(['patient', 'clinic'])
      expect(FavoriteClinics.indexes![0]!.unique).toBe(true)
    })

    it('should have correct access control configuration', async () => {
      const { FavoriteClinics } = await import('@/collections/FavoriteClinics')

      expect(FavoriteClinics.access).toBeDefined()
      expect(FavoriteClinics.access!.read).toBeDefined()
      expect(FavoriteClinics.access!.create).toBeDefined()
      expect(FavoriteClinics.access!.update).toBeDefined()
      expect(FavoriteClinics.access!.delete).toBeDefined()
    })
  })
})