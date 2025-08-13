/**
 * Unit Tests for Accreditations Seed Module
 *
 * Tests the upsert logic for healthcare accreditations seeding
 * without full integration overhead.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock the upsertByUniqueField helper
vi.mock('@/endpoints/seed/seed-helpers', () => ({
  upsertByUniqueField: vi.fn(),
}))

// Import after mock
import { seedAccreditations } from '@/endpoints/seed/medical/accreditations-seed'
import { upsertByUniqueField } from '@/endpoints/seed/seed-helpers'

// Mock payload logger
const mockPayload = {
  logger: {
    info: vi.fn(),
  },
}

describe('seedAccreditations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(upsertByUniqueField).mockResolvedValue({
      created: true,
      updated: false,
      doc: { id: 'test-id', name: 'Test Accreditation' },
    })
  })

  test('seeds all expected accreditations', async () => {
    const result = await seedAccreditations(mockPayload as any)

    // Should attempt to upsert 4 accreditations
    expect(upsertByUniqueField).toHaveBeenCalledTimes(4)

    // Check specific accreditations are included
    const calls = vi.mocked(upsertByUniqueField).mock.calls
    const accreditationNames = calls.map(call => call[3].name)
    
    expect(accreditationNames).toContain('Joint Commission International')
    expect(accreditationNames).toContain('International Organization for Standardization 9001')
    expect(accreditationNames).toContain('International Medical Travel and Global Healthcare Accreditation')
    expect(accreditationNames).toContain('Australian Council on Healthcare Standards')

    // Check all calls use correct collection and field
    for (const call of calls) {
      expect(call[1]).toBe('accreditation') // collection
      expect(call[2]).toBe('name') // unique field
    }

    // Should return correct counts when all are created
    expect(result).toEqual({ created: 4, updated: 0 })
  })

  test('handles upsert with updates instead of creates', async () => {
    vi.mocked(upsertByUniqueField).mockResolvedValue({
      created: false,
      updated: true,
      doc: { id: 'existing-id', name: 'Existing Accreditation' },
    })

    const result = await seedAccreditations(mockPayload as any)

    expect(result).toEqual({ created: 0, updated: 4 })
  })

  test('handles mixed create and update scenarios', async () => {
    vi.mocked(upsertByUniqueField)
      .mockResolvedValueOnce({ created: true, updated: false, doc: {} })
      .mockResolvedValueOnce({ created: false, updated: true, doc: {} })
      .mockResolvedValueOnce({ created: true, updated: false, doc: {} })
      .mockResolvedValueOnce({ created: false, updated: true, doc: {} })

    const result = await seedAccreditations(mockPayload as any)

    expect(result).toEqual({ created: 2, updated: 2 })
  })

  test('includes required fields for each accreditation', async () => {
    await seedAccreditations(mockPayload as any)

    const calls = vi.mocked(upsertByUniqueField).mock.calls
    
    for (const call of calls) {
      const accreditation = call[3]
      expect(accreditation).toHaveProperty('name')
      expect(accreditation).toHaveProperty('abbreviation')
      expect(accreditation).toHaveProperty('country')
      expect(accreditation).toHaveProperty('description')
      
      // Ensure all required fields are non-empty strings
      expect(typeof accreditation.name).toBe('string')
      expect(accreditation.name.length).toBeGreaterThan(0)
      expect(typeof accreditation.abbreviation).toBe('string')
      expect(accreditation.abbreviation.length).toBeGreaterThan(0)
      expect(typeof accreditation.country).toBe('string')
      expect(accreditation.country.length).toBeGreaterThan(0)
      expect(typeof accreditation.description).toBe('string')
      expect(accreditation.description.length).toBeGreaterThan(0)
    }
  })

  test('logs appropriate messages', async () => {
    await seedAccreditations(mockPayload as any)

    expect(mockPayload.logger.info).toHaveBeenCalledWith('— Seeding accreditations (idempotent)...')
    expect(mockPayload.logger.info).toHaveBeenCalledWith('— Finished seeding accreditations.')
  })
})