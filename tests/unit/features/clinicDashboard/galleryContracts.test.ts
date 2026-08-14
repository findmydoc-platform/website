import { describe, expect, it } from 'vitest'

import {
  clinicGalleryConstraints,
  clinicGalleryDiscardInputSchema,
  clinicGallerySaveInputSchema,
} from '@/features/clinicDashboard/gallery/contracts'

describe('clinic dashboard gallery contracts', () => {
  it('publishes the platform-aligned upload constraints', () => {
    expect(clinicGalleryConstraints).toEqual({
      acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
      maxFileBytes: 4 * 1024 * 1024,
      maxItems: 12,
      maxConcurrentUploads: 3,
      maxPixels: 50_000_000,
    })
  })

  it('accepts empty, single, and twelve-item saves but rejects thirteen', () => {
    const item = (index: number) => ({ mediaId: String(index + 1), alt: `Clinic image ${index + 1}` })
    for (const count of [0, 1, 12]) {
      expect(
        clinicGallerySaveInputSchema.safeParse({
          expectedRevision: 4,
          items: Array.from({ length: count }, (_, i) => item(i)),
        }).success,
      ).toBe(true)
    }
    expect(
      clinicGallerySaveInputSchema.safeParse({
        expectedRevision: 4,
        items: Array.from({ length: 13 }, (_, i) => item(i)),
      }).success,
    ).toBe(false)
  })

  it('rejects blank alt text, duplicate save IDs, and oversized discard batches', () => {
    expect(
      clinicGallerySaveInputSchema.safeParse({
        expectedRevision: 1,
        items: [{ mediaId: '1', alt: '' }],
      }).success,
    ).toBe(false)
    expect(
      clinicGallerySaveInputSchema.safeParse({
        expectedRevision: 1,
        items: [
          { mediaId: '1', alt: 'One' },
          { mediaId: '1', alt: 'Duplicate' },
        ],
      }).success,
    ).toBe(false)
    expect(
      clinicGalleryDiscardInputSchema.safeParse({
        mediaIds: Array.from({ length: 13 }, (_, index) => String(index + 1)),
      }).success,
    ).toBe(false)
  })
})
