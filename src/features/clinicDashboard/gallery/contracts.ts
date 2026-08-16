import { z } from 'zod'

import { MEDIA_UPLOAD_MAX_BYTES } from '@/config/mediaUploadPolicy'
import { CLINIC_MEDIA_MAX_PIXELS } from '@/hooks/media/normalizeClinicMediaUpload'
import { clinicProfileMediaImageMimeTypes } from '@/collections/common/mediaCollection'
import { clinicProfileGalleryMaxItems } from '@/collections/clinics/profileGallery'

const mediaIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u)
const altSchema = z.string().trim().max(2_000)
const publishedAltSchema = altSchema.min(1)
const captionSchema = z.string().trim().max(10_000)

export const clinicGallerySaveInputSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    items: z
      .array(
        z
          .object({
            alt: publishedAltSchema,
            captionText: captionSchema.optional(),
            mediaId: mediaIdSchema,
          })
          .strict(),
      )
      .max(clinicProfileGalleryMaxItems),
  })
  .strict()
  .superRefine(({ items }, context) => {
    if (new Set(items.map((item) => item.mediaId)).size !== items.length) {
      context.addIssue({ code: 'custom', message: 'Gallery media identifiers must be unique.', path: ['items'] })
    }
  })

export const clinicGalleryDiscardInputSchema = z
  .object({
    mediaIds: z.array(mediaIdSchema).min(1).max(clinicProfileGalleryMaxItems),
  })
  .strict()
  .superRefine(({ mediaIds }, context) => {
    if (new Set(mediaIds).size !== mediaIds.length) {
      context.addIssue({ code: 'custom', message: 'Draft media identifiers must be unique.', path: ['mediaIds'] })
    }
  })

export const clinicGalleryUploadInputSchema = z
  .object({
    alt: altSchema.optional(),
    captionText: captionSchema.optional(),
  })
  .strict()

export type ClinicGallerySaveInput = z.infer<typeof clinicGallerySaveInputSchema>
export type ClinicGalleryDiscardInput = z.infer<typeof clinicGalleryDiscardInputSchema>
export type ClinicGalleryUploadInput = z.infer<typeof clinicGalleryUploadInputSchema>

export type ClinicGalleryMediaDTO = {
  alt: string
  captionText?: string
  height?: number
  id: string
  status: 'draft' | 'published'
  thumbnailUrl?: string
  url: string
  width?: number
}

export type ClinicGallerySnapshotDTO = {
  constraints: {
    acceptedMimeTypes: readonly string[]
    maxConcurrentUploads: 3
    maxFileBytes: number
    maxItems: number
    maxPixels: number
  }
  items: ClinicGalleryMediaDTO[]
  revision: number
}

export const clinicGalleryConstraints = {
  acceptedMimeTypes: clinicProfileMediaImageMimeTypes,
  maxConcurrentUploads: 3,
  maxFileBytes: MEDIA_UPLOAD_MAX_BYTES,
  maxItems: clinicProfileGalleryMaxItems,
  maxPixels: CLINIC_MEDIA_MAX_PIXELS,
} as const
