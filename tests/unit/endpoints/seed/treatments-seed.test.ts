/**
 * Unit Tests for Treatments Seed Module
 *
 * Verifies that treatments seeding uses the correct helpers, logs messages,
 * and upserts by unique field `name` into the `treatments` collection.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock the seed helpers
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

// Import after mocks
import { seedTreatments } from '@/endpoints/seed/medical/treatments-seed'
import { upsertByUniqueField } from '@/endpoints/seed/seed-helpers'

// Minimal mocked Payload instance
const mockPayload = {
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  // Return a subset of specialties sufficient to seed a few treatments
  find: vi.fn().mockResolvedValue({
    docs: [
      { id: 'spec-1', name: 'Hair Loss Clinics / Hair Transplant' },
      { id: 'spec-2', name: 'Cosmetic / Plastic Surgery' },
      { id: 'spec-3', name: 'Dental Treatment / Dentistry' },
      { id: 'spec-4', name: 'Cosmetic Dentists' },
      { id: 'spec-5', name: 'Ophthalmology' },
      { id: 'spec-6', name: 'Bariatric Surgery' },
      { id: 'spec-7', name: 'Hematology Oncology' },
      { id: 'spec-8', name: 'Medical Aesthetics / Beauty Clinics' },
      { id: 'spec-9', name: 'Obstetrics & Gynecology' },
      { id: 'spec-10', name: 'Urology' },
      { id: 'spec-11', name: 'Neurology' },
      { id: 'spec-12', name: 'General Surgery' },
    ],
  }),
}

describe('seedTreatments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('upserts treatments by name and logs start/end', async () => {
    vi.mocked(upsertByUniqueField).mockResolvedValue({
      created: true,
      updated: false,
      doc: { id: 't1' },
    })

    const result = await seedTreatments(mockPayload as any)

    // Start/finish logs
    expect(mockPayload.logger.info).toHaveBeenCalledWith('— Seeding treatments (idempotent)...')
    expect(mockPayload.logger.info).toHaveBeenCalledWith('— Finished seeding treatments.')

  // Should perform at least one upsert
  expect(upsertByUniqueField).toHaveBeenCalled()
  expect(vi.mocked(upsertByUniqueField).mock.calls.length).toBeGreaterThan(0)

  // Verify target collection and unique field
  const firstCall = vi.mocked(upsertByUniqueField).mock.calls[0] as unknown as [any, string, string, any]
  const [, collectionArg, uniqueFieldArg, dataArg] = firstCall
    expect(collectionArg).toBe('treatments')
    expect(uniqueFieldArg).toBe('name')

    // Description is converted to rich text object
    expect(typeof dataArg.description).toBe('object')

    // Should report at least one created
    expect(result.created).toBeGreaterThan(0)
  })

  test('handles update-only path', async () => {
    vi.mocked(upsertByUniqueField).mockResolvedValue({
      created: false,
      updated: true,
      doc: { id: 't-existing' },
    })

    const result = await seedTreatments(mockPayload as any)
    expect(result.updated).toBeGreaterThanOrEqual(1)
  })
})
