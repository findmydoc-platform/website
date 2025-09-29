import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'node:crypto'

import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { isClinicBasicUser } from '@/access/isClinicBasicUser'
import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'
import { clinicGalleryReadAccess, clinicGalleryScopedMutationAccess } from '@/access/clinicGallery'
import { beforeChangeFreezeRelation } from '@/hooks/ownership'
import { beforeChangeImmutableField } from '@/hooks/immutability'
import { beforeChangeCreatedBy } from '@/hooks/createdBy'
import { beforeChangeComputeStorage } from '@/hooks/media/computeStorage'
import { beforeChangePublishedAt } from '@/hooks/publishedAt'

const STORAGE_KEY_PREFIX = 'cgmedia'

const generateStorageKey = (): string => {
  const uniqueSegment = randomUUID().replace(/-/g, '')
  return `${STORAGE_KEY_PREFIX}-${uniqueSegment}`
}

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']

export const ClinicGalleryMedia: CollectionConfig = {
  slug: 'clinicGalleryMedia',
  admin: {
    group: 'Clinics',
    description: 'Clinic gallery assets (before/after imagery) with publication controls',
    defaultColumns: ['clinic', 'status', 'alt', 'createdBy'],
  },
  access: {
    read: clinicGalleryReadAccess,
    create: async ({ req, data }) => {
      if (isPlatformBasicUser({ req })) return true

      if (isClinicBasicUser({ req })) {
        const clinicId = await getUserAssignedClinicId(req.user, req.payload)
        const targetClinic =
          typeof (data as any)?.clinic === 'object' ? (data as any).clinic?.id : (data as any)?.clinic
        return Boolean(clinicId && targetClinic && String(clinicId) === String(targetClinic))
      }

      return false
    },
    update: clinicGalleryScopedMutationAccess,
    delete: clinicGalleryScopedMutationAccess,
  },
  trash: true,
  hooks: {
    beforeChange: [
      beforeChangeFreezeRelation({ relationField: 'clinic', message: 'Clinic ownership cannot be changed once set' }),
      beforeChangeImmutableField({ field: 'storageKey', message: 'Storage key cannot be changed once set' }),
      beforeChangeCreatedBy({ createdByField: 'createdBy', userCollection: 'basicUsers' }),
      beforeChangeComputeStorage({ ownerField: 'clinic', key: { type: 'field', name: 'storageKey' }, storagePrefix: 'clinics-gallery' }),
      beforeChangePublishedAt({ statusKey: 'status', publishedAtKey: 'publishedAt', publishedValue: 'published' }),
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Screen-reader alternative text',
      },
    },
    {
      name: 'caption',
      type: 'richText',
      admin: {
        description: 'Optional caption displayed with the media',
      },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: {
        description: 'Owning clinic',
      },
    },
    {
      name: 'pairRole',
      type: 'select',
      defaultValue: 'single',
      options: [
        { label: 'Single', value: 'single' },
        { label: 'Before', value: 'before' },
        { label: 'After', value: 'after' },
      ],
      admin: {
        description: 'Hint for grouping media into before/after pairs',
      },
    },
    {
      name: 'pairGroupId',
      type: 'text',
      admin: {
        description: 'Optional grouping identifier for pairing media',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      admin: {
        description: 'Publishing state controls visibility for non-clinic users',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        description: 'Timestamp automatically set when media is published',
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'consentGranted',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Indicate whether patient consent is on file',
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'basicUsers',
      required: true,
      admin: {
        description: 'Who performed the upload (auto-set)',
      },
    },
    {
      name: 'storageKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      defaultValue: generateStorageKey,
      admin: {
        hidden: true,
      },
    },
    {
      name: 'storagePath',
      type: 'text',
      required: true,
      admin: {
        description: 'Resolved storage path used in storage',
        readOnly: true,
      },
    },
  ],
  upload: {
    staticDir: path.resolve(dirname, '../../public/clinic-gallery-media'),
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    mimeTypes: imageMimeTypes,
    imageSizes: [
      { name: 'thumbnail', width: 300 },
      { name: 'square', width: 500, height: 500 },
      { name: 'small', width: 600 },
      { name: 'medium', width: 900 },
      { name: 'large', width: 1400 },
      { name: 'xlarge', width: 1920 },
      { name: 'og', width: 1200, height: 630, crop: 'center' },
    ],
  },
}
