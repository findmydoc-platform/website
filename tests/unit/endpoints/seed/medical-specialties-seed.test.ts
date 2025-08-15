/**
 * Unit Tests for Medical Specialties Seed Module
 *
 * Tests the upsert logic for medical specialties seeding
 * with the new consolidated category tree structure.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock the seed helpers
vi.mock('@/endpoints/seed/seed-helpers', () => ({
  upsertByUniqueField: vi.fn(),
}))

// Import after mock
import { seedMedicalSpecialties } from '@/endpoints/seed/medical/medical-specialties-seed'
import { upsertByUniqueField } from '@/endpoints/seed/seed-helpers'

// Mock payload
const mockPayload = {
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}

describe('seedMedicalSpecialties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(upsertByUniqueField).mockResolvedValue({
      created: true,
      updated: false,
      doc: { id: 'test-id', name: 'Test Specialty' },
    })
  })

  test('seeds root categories first then subcategories', async () => {
    const result = await seedMedicalSpecialties(mockPayload as any)

    // Should call upsert for all root categories + subcategories
    const expectedCallCount = 8 + 26 // 8 root categories + 26 subcategories
    expect(upsertByUniqueField).toHaveBeenCalledTimes(expectedCallCount)

    // Check that root categories are created without parent
    const calls = vi.mocked(upsertByUniqueField).mock.calls
    
    // First 8 calls should be root categories (no parentSpecialty)
    for (let i = 0; i < 8; i++) {
      const categoryData = calls[i]![3]
      expect(categoryData).not.toHaveProperty('parentSpecialty')
    }

    // Remaining calls should be subcategories (with parentSpecialty)
    for (let i = 8; i < expectedCallCount; i++) {
      const categoryData = calls[i]![3]
      expect(categoryData).toHaveProperty('parentSpecialty')
      expect(categoryData.parentSpecialty).toBe('test-id') // mocked parent ID
    }

    // Should return correct counts when all created
    expect(result).toEqual({ created: expectedCallCount, updated: 0 })
  })

  test('includes all expected root categories', async () => {
    await seedMedicalSpecialties(mockPayload as any)

    const calls = vi.mocked(upsertByUniqueField).mock.calls
    const rootCategoryNames = calls.slice(0, 8).map(call => call[3].name)
    
    expect(rootCategoryNames).toContain('Aesthetics & Cosmetic Medicine')
    expect(rootCategoryNames).toContain('Alternative & Holistic Medicine')
    expect(rootCategoryNames).toContain('Dentistry & Oral Health')
    expect(rootCategoryNames).toContain('Dermatology & Skin')
    expect(rootCategoryNames).toContain('Diagnostics & Imaging')
    expect(rootCategoryNames).toContain('Eye, ENT & Ophthalmology')
    expect(rootCategoryNames).toContain('General Practice & Primary Care')
    expect(rootCategoryNames).toContain('Medicine (Non-Surgical Specialties)')
  })

  test('includes aesthetics subcategories', async () => {
    await seedMedicalSpecialties(mockPayload as any)

    const calls = vi.mocked(upsertByUniqueField).mock.calls
    const subcategoryNames = calls.slice(8).map(call => call[3].name)
    
    expect(subcategoryNames).toContain('Aesthetic Medicine & Cosmetology')
    expect(subcategoryNames).toContain('Beauty Salons')
    expect(subcategoryNames).toContain('Cosmetic / Plastic Surgery')
    expect(subcategoryNames).toContain('Cosmetology')
    expect(subcategoryNames).toContain('Hair Loss Clinics / Hair Transplant')
    expect(subcategoryNames).toContain('Medical Aesthetics / Beauty Clinics')
  })

  test('includes dentistry subcategories', async () => {
    await seedMedicalSpecialties(mockPayload as any)

    const calls = vi.mocked(upsertByUniqueField).mock.calls
    const subcategoryNames = calls.slice(8).map(call => call[3].name)
    
    expect(subcategoryNames).toContain('Cosmetic Dentists')
    expect(subcategoryNames).toContain('Dental Treatment / Dentistry')
    expect(subcategoryNames).toContain('Dentists')
    expect(subcategoryNames).toContain('Maxillofacial Surgery')
    expect(subcategoryNames).toContain('Orthodontists')
  })

  test('includes eye/ENT subcategories', async () => {
    await seedMedicalSpecialties(mockPayload as any)

    const calls = vi.mocked(upsertByUniqueField).mock.calls
    const subcategoryNames = calls.slice(8).map(call => call[3].name)
    
    expect(subcategoryNames).toContain('Ear, Nose and Throat (ENT)')
    expect(subcategoryNames).toContain('Eye Care / Eye Clinics')
    expect(subcategoryNames).toContain('LASIK Laser Eye Surgery')
    expect(subcategoryNames).toContain('Otorhinolaryngology')
    expect(subcategoryNames).toContain('Ophthalmology')
  })

  test('uses correct collection and unique field', async () => {
    await seedMedicalSpecialties(mockPayload as any)

    const calls = vi.mocked(upsertByUniqueField).mock.calls
    
    // All calls should use medical-specialties collection and name field
    calls.forEach(call => {
      expect(call[1]).toBe('medical-specialties') // collection
      expect(call[2]).toBe('name') // unique field
    })
  })

  test('handles mixed create/update results', async () => {
    // Mock some as created, some as updated
    vi.mocked(upsertByUniqueField)
      .mockResolvedValueOnce({ created: true, updated: false, doc: { id: '1' } })
      .mockResolvedValueOnce({ created: false, updated: true, doc: { id: '2' } })
      .mockResolvedValueOnce({ created: true, updated: false, doc: { id: '3' } })

    // Mock remaining calls to avoid issues
    for (let i = 0; i < 31; i++) {
      vi.mocked(upsertByUniqueField).mockResolvedValueOnce({ 
        created: false, 
        updated: false, 
        doc: { id: `${i + 4}` } 
      })
    }

    const result = await seedMedicalSpecialties(mockPayload as any)

    expect(result).toEqual({ created: 2, updated: 1 })
  })

  test('includes required fields for all specialties', async () => {
    await seedMedicalSpecialties(mockPayload as any)

    const calls = vi.mocked(upsertByUniqueField).mock.calls
    
    calls.forEach(call => {
      const specialty = call[3]
      expect(specialty).toHaveProperty('name')
      expect(specialty).toHaveProperty('description')
      expect(typeof specialty.name).toBe('string')
      expect(specialty.name.length).toBeGreaterThan(0)
      expect(typeof specialty.description).toBe('string')
      expect(specialty.description.length).toBeGreaterThan(0)
    })
  })

  test('logs appropriate messages', async () => {
    await seedMedicalSpecialties(mockPayload as any)

    expect(mockPayload.logger.info).toHaveBeenCalledWith('— Seeding medical specialties (idempotent)...')
    expect(mockPayload.logger.info).toHaveBeenCalledWith('— Finished seeding medical specialties.')
  })
})