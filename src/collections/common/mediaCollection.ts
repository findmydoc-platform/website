import type { CollectionSlug, Field } from 'payload'

type MediaUploadImageSize = {
  crop?: 'center'
  height?: number
  name: string
  width: number
}

export type MediaUploadConfig = {
  adminThumbnail: string
  focalPoint: boolean
  imageSizes: MediaUploadImageSize[]
  mimeTypes: string[]
  staticDir: string
}

export const standardMediaImageMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
]

export const galleryMediaImageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']

export const standardMediaImageSizes: MediaUploadImageSize[] = [
  { name: 'thumbnail', width: 300 },
  { name: 'square', width: 500, height: 500 },
  { name: 'small', width: 600 },
  { name: 'medium', width: 900 },
  { name: 'large', width: 1400 },
  { name: 'xlarge', width: 1920 },
  { name: 'og', width: 1200, height: 630, crop: 'center' },
]

export function buildMediaUploadConfig(options: {
  staticDir: string
  mimeTypes?: string[]
  adminThumbnail?: string
  focalPoint?: boolean
  imageSizes?: MediaUploadImageSize[]
}): MediaUploadConfig {
  return {
    staticDir: options.staticDir,
    adminThumbnail: options.adminThumbnail ?? 'thumbnail',
    focalPoint: options.focalPoint ?? true,
    mimeTypes: options.mimeTypes ?? standardMediaImageMimeTypes,
    imageSizes: options.imageSizes ?? standardMediaImageSizes,
  }
}

export function buildMediaAltField(options?: { label?: string; description?: string }): Field {
  return {
    ...(options?.label ? { label: options.label } : {}),
    name: 'alt',
    type: 'text',
    required: true,
    admin: {
      description: options?.description ?? 'Screen-reader alternative text',
    },
  }
}

export function buildMediaCaptionField(options?: { name?: string; label?: string; description?: string }): Field {
  return {
    ...(options?.label ? { label: options.label } : {}),
    name: options?.name ?? 'caption',
    type: 'richText',
    required: false,
    admin: {
      description: options?.description ?? 'Optional caption displayed with the media',
    },
  }
}

export function buildMediaCreatedByField(options: {
  relationTo: CollectionSlug
  label?: string
  description?: string
  readOnly?: boolean
  hidden?: boolean
  position?: 'sidebar'
}): Field
export function buildMediaCreatedByField(options: {
  relationTo: CollectionSlug[]
  label?: string
  description?: string
  readOnly?: boolean
  hidden?: boolean
  position?: 'sidebar'
}): Field
export function buildMediaCreatedByField(options: {
  relationTo: CollectionSlug | CollectionSlug[]
  label?: string
  description?: string
  readOnly?: boolean
  hidden?: boolean
  position?: 'sidebar'
}): Field {
  return {
    ...(options.label ? { label: options.label } : {}),
    name: 'createdBy',
    type: 'relationship',
    relationTo: options.relationTo,
    required: true,
    admin: {
      description: options.description ?? 'Who performed the upload (auto-set)',
      ...(options.readOnly !== undefined ? { readOnly: options.readOnly } : {}),
      ...(options.hidden !== undefined ? { hidden: options.hidden } : {}),
      ...(options.position ? { position: options.position } : {}),
      condition: () => false,
    },
  } as Field
}

export function buildMediaStoragePathField(options?: { label?: string; description?: string }): Field {
  return {
    ...(options?.label ? { label: options.label } : {}),
    name: 'storagePath',
    type: 'text',
    required: true,
    admin: {
      description: options?.description ?? 'Resolved storage path used in storage',
      readOnly: true,
      hidden: true,
    },
  }
}

export function buildMediaPrefixField(options?: { label?: string; description?: string }): Field {
  return {
    ...(options?.label ? { label: options.label } : {}),
    name: 'prefix',
    type: 'text',
    admin: {
      hidden: true,
      readOnly: true,
      description: options?.description ?? 'S3 storage prefix (managed by plugin)',
    },
    access: {
      read: () => true,
      update: () => false,
    },
  }
}
