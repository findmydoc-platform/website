/**
 * Unit Tests for Accreditations Seed Module
 *
 * Tests the upsert logic for healthcare accreditations seeding
 * without full integration overhead.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock the seed helpers
vi.mock('@/endpoints/seed/seed-helpers', () => ({
  upsertByUniqueField: vi.fn(),
  createMediaFromBase64: vi.fn(),
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
import { upsertByUniqueField, createMediaFromBase64, textToRichText } from '@/endpoints/seed/seed-helpers'

// Mock payload
const mockPayload = {
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
  find: vi.fn(),
}

describe('seedAccreditations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(upsertByUniqueField).mockResolvedValue({
      created: true,
      updated: false,
      doc: { id: 'test-id', name: 'Test Accreditation' },
    })
    vi.mocked(createMediaFromBase64).mockResolvedValue({
      id: 'media-id',
      filename: 'jci-logo.png',
    })
    vi.mocked(mockPayload.find).mockResolvedValue({
      totalDocs: 0,
      docs: [],
    })
  })

  test('seeds JCI accreditation with icon', async () => {
    const result = await seedAccreditations(mockPayload as any)

    // Should attempt to upsert 1 accreditation
    expect(upsertByUniqueField).toHaveBeenCalledTimes(1)

    // Check specific accreditation is included
    const calls = vi.mocked(upsertByUniqueField).mock.calls
    const accreditation = calls[0]![3]
    
    expect(accreditation.name).toBe('Joint Commission International')
    expect(accreditation.abbreviation).toBe('JCI')
    expect(accreditation.country).toBe('United States')
    expect(accreditation.description).toEqual({
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
                text: 'Goldstandard für internationale Gesundheitsversorgung, Schwerpunkt auf Patientensicherheit und Qualitätsverbesserung',
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
    })
    expect(accreditation.icon).toBe('media-id')

    // Check call uses correct collection and field
    expect(calls[0]![1]).toBe('accreditation') // collection
    expect(calls[0]![2]).toBe('name') // unique field

    // Should return correct counts when created
    expect(result).toEqual({ created: 1, updated: 0 })
  })

  test('reuses existing JCI logo media', async () => {
    vi.mocked(mockPayload.find).mockResolvedValue({
      totalDocs: 1,
      docs: [{ id: 'existing-media-id', filename: 'jci-logo.png' }],
    })

    await seedAccreditations(mockPayload as any)

    // Should not create new media
    expect(createMediaFromBase64).not.toHaveBeenCalled()
    
    // Should use existing media ID
    const calls = vi.mocked(upsertByUniqueField).mock.calls
    const accreditation = calls[0]![3]
    expect(accreditation.icon).toBe('existing-media-id')
  })

  test('handles media creation failure gracefully', async () => {
    vi.mocked(createMediaFromBase64).mockRejectedValue(new Error('Media creation failed'))

    const result = await seedAccreditations(mockPayload as any)

    // Should still proceed with seeding
    expect(upsertByUniqueField).toHaveBeenCalledTimes(1)
    
    // Icon should be null when media creation fails
    const calls = vi.mocked(upsertByUniqueField).mock.calls
    const accreditation = calls[0]![3]
    expect(accreditation.icon).toBeNull()

    // Should log error
    expect(mockPayload.logger.error).toHaveBeenCalledWith('— Failed to create JCI logo media:', expect.any(Error))

    expect(result).toEqual({ created: 1, updated: 0 })
  })

  test('handles upsert with update instead of create', async () => {
    vi.mocked(upsertByUniqueField).mockResolvedValue({
      created: false,
      updated: true,
      doc: { id: 'existing-id', name: 'Existing Accreditation' },
    })

    const result = await seedAccreditations(mockPayload as any)

    expect(result).toEqual({ created: 0, updated: 1 })
  })

  test('includes all required fields for JCI accreditation', async () => {
    await seedAccreditations(mockPayload as any)

    const calls = vi.mocked(upsertByUniqueField).mock.calls
    const accreditation = calls[0]![3]
    
    expect(accreditation).toHaveProperty('name')
    expect(accreditation).toHaveProperty('abbreviation')
    expect(accreditation).toHaveProperty('country')
    expect(accreditation).toHaveProperty('description')
    expect(accreditation).toHaveProperty('icon')
    
    // Ensure all required fields are non-empty strings
    expect(typeof accreditation.name).toBe('string')
    expect(accreditation.name.length).toBeGreaterThan(0)
    expect(typeof accreditation.abbreviation).toBe('string')
    expect(accreditation.abbreviation.length).toBeGreaterThan(0)
    expect(typeof accreditation.country).toBe('string')
    expect(accreditation.country.length).toBeGreaterThan(0)
    expect(typeof accreditation.description).toBe('object')
    expect(accreditation.description.root).toBeDefined()
    expect(accreditation.description.root.children).toBeDefined()
    expect(accreditation.description.root.children.length).toBeGreaterThan(0)
  })

  test('logs appropriate messages', async () => {
    await seedAccreditations(mockPayload as any)

    expect(mockPayload.logger.info).toHaveBeenCalledWith('— Seeding accreditations (idempotent)...')
    expect(mockPayload.logger.info).toHaveBeenCalledWith('— Created JCI logo media')
    expect(mockPayload.logger.info).toHaveBeenCalledWith('— Finished seeding accreditations.')
  })
})