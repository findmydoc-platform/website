import type { PayloadRequest, SanitizedCollectionConfig } from 'payload'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import {
  beforeOperationNormalizeClinicMediaUpload,
  CLINIC_MEDIA_MAX_PIXELS,
  isClinicMediaWithinPixelLimit,
} from '@/hooks/media/normalizeClinicMediaUpload'

const collection = { slug: 'clinicMedia' } as SanitizedCollectionConfig

describe('clinic media upload normalization', () => {
  it('enforces the 50 megapixel boundary', () => {
    expect(isClinicMediaWithinPixelLimit(10_000, 5_000)).toBe(true)
    expect(isClinicMediaWithinPixelLimit(10_000, 5_001)).toBe(false)
    expect(CLINIC_MEDIA_MAX_PIXELS).toBe(50_000_000)
  })

  it('normalizes orientation and strips EXIF metadata before Payload creates variants', async () => {
    const source = await sharp({
      create: { width: 8, height: 4, channels: 3, background: '#aa3355' },
    })
      .jpeg()
      .withMetadata({ orientation: 6, exif: { IFD0: { Artist: 'Clinic GPS camera' } } })
      .toBuffer()
    const file = { data: source, mimetype: 'image/jpeg', size: source.length }
    const req = { context: {}, file } as unknown as PayloadRequest

    await beforeOperationNormalizeClinicMediaUpload({
      args: { data: {} },
      collection,
      operation: 'create',
      req,
    } as never)

    const normalized = file.data as Buffer
    const metadata = await sharp(normalized).metadata()
    expect(metadata.width).toBe(4)
    expect(metadata.height).toBe(8)
    expect(metadata.orientation).toBeUndefined()
    expect(metadata.exif).toBeUndefined()
    expect(file.size).toBe(normalized.length)
  })

  it.each([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
    ['avif', 'image/avif'],
  ] as const)('preserves %s as its output format', async (format, mimeType) => {
    const source = await sharp({ create: { width: 4, height: 3, channels: 3, background: '#113355' } })
      .toFormat(format)
      .toBuffer()
    const file = { data: source, mimetype: mimeType, size: source.length }
    const req = { context: {}, file } as unknown as PayloadRequest

    await beforeOperationNormalizeClinicMediaUpload({
      args: { data: {} },
      collection,
      operation: 'create',
      req,
    } as never)

    expect((await sharp(file.data as Buffer).metadata()).format).toBe(format === 'avif' ? 'heif' : format)
    expect(file.mimetype).toBe(mimeType)
  })
})
