/**
 * Unit Tests for Accreditations Seed Module
 *
 * Tests the upsert logic for healthcare accreditations seeding
 * without full integration overhead.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock the seed helpers (no media in scope)
vi.mock('@/endpoints/seed/seed-helpers', () => ({
  upsertByUniqueField: vi.fn(),
  textToRichText: vi.fn((text: string) => ({
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text,
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  })),
}))

// Import after mock
import { seedAccreditations } from '@/endpoints/seed/medical/accreditations-seed'
import { upsertByUniqueField } from '@/endpoints/seed/seed-helpers'

// Mock payload (only logger is needed)
const mockPayload = {
  logger: {
    info: vi.fn(),
    error: vi.fn(),
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

  test('seeds accreditations and includes JCI (no media)', async () => {
    const result = await seedAccreditations(mockPayload as any)

    // Should attempt to upsert and include JCI
    expect(upsertByUniqueField).toHaveBeenCalled()

    const calls = vi.mocked(upsertByUniqueField).mock.calls
    const anyJciCall = calls.find((c) => c[3]?.abbreviation === 'JCI')
    expect(anyJciCall).toBeTruthy()
    const accreditation = anyJciCall![3]

    expect(accreditation.name).toBe('Joint Commission International')
    expect(accreditation.abbreviation).toBe('JCI')
    expect(accreditation.country).toBe('United States')
    expect(typeof accreditation.description).toBe('object')

    // Should use collection and unique field by abbreviation
    expect(anyJciCall![1]).toBe('accreditation')
    expect(anyJciCall![2]).toBe('abbreviation')

    // Should return some created count
    expect(result.created).toBeGreaterThan(0)
  })

  test('handles upsert with update instead of create', async () => {
    vi.mocked(upsertByUniqueField).mockResolvedValue({
      created: false,
      updated: true,
      doc: { id: 'existing-id', name: 'Existing Accreditation' },
    })

    const result = await seedAccreditations(mockPayload as any)
    expect(result.updated).toBeGreaterThanOrEqual(1)
  })

  test('includes required fields for JCI accreditation', async () => {
    await seedAccreditations(mockPayload as any)

    const calls = vi.mocked(upsertByUniqueField).mock.calls
    const accreditation = calls.find((c) => c[3]?.abbreviation === 'JCI')![3]

    expect(accreditation).toHaveProperty('name')
    expect(accreditation).toHaveProperty('abbreviation')
    expect(accreditation).toHaveProperty('country')
    expect(accreditation).toHaveProperty('description')

    expect(typeof accreditation.name).toBe('string')
    expect(accreditation.name.length).toBeGreaterThan(0)
    expect(typeof accreditation.abbreviation).toBe('string')
    expect(accreditation.abbreviation.length).toBeGreaterThan(0)
    expect(typeof accreditation.country).toBe('string')
    expect(accreditation.country.length).toBeGreaterThan(0)
    expect(typeof accreditation.description).toBe('object')
  })

  test('logs appropriate messages', async () => {
    await seedAccreditations(mockPayload as any)

    expect(mockPayload.logger.info).toHaveBeenCalledWith('— Seeding accreditations (idempotent)...')
    expect(mockPayload.logger.info).toHaveBeenCalledWith('— Finished seeding accreditations.')
  })
})
