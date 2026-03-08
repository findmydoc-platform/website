import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'node:crypto'

import { clinicGalleryReadAccess, clinicGalleryScopedMutationAccess } from '@/access/clinicGallery'
import { platformOrAssignedClinicMutation } from '@/access/scopeFilters'
import { beforeChangeAssignClinicFromUser } from '@/hooks/clinicOwnership'
import { beforeChangeFreezeRelation } from '@/hooks/ownership'
import { beforeChangeImmutableField } from '@/hooks/immutability'
import { beforeChangeCreatedBy } from '@/hooks/createdBy'
import { beforeChangeComputeStorage } from '@/hooks/media/computeStorage'
import { afterChangeLogStorageOperation } from '@/hooks/media/afterChangeLogStorageOperation'
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
    description: 'Clinic-owned gallery assets with publication controls',
    defaultColumns: ['clinic', 'status', 'alt', 'createdBy'],
  },
  access: {
    read: clinicGalleryReadAccess,
    create: platformOrAssignedClinicMutation,
    update: clinicGalleryScopedMutationAccess,
    delete: clinicGalleryScopedMutationAccess,
  },
  trash: true,
  hooks: {
    beforeChange: [
      beforeChangeAssignClinicFromUser({ clinicField: 'clinic' }),
      beforeChangeFreezeRelation({
        relationField: 'clinic',
        message: 'Clinic ownership cannot be changed once set',
      }),
      beforeChangeImmutableField({
        field: 'storageKey',
        message: 'Storage key cannot be changed once set',
      }),
      beforeChangeCreatedBy({ createdByField: 'createdBy', userCollection: 'basicUsers' }),
      beforeChangeComputeStorage({
        ownerField: 'clinic',
        key: { type: 'field', name: 'storageKey' },
        storagePrefix: 'clinics-gallery',
      }),
      beforeChangePublishedAt({
        statusKey: 'status',
        publishedAtKey: 'publishedAt',
        publishedValue: 'published',
      }),
    ],
    afterChange: [afterChangeLogStorageOperation('clinicGalleryMedia')],
  },
  fields: [
    {
      name: 'alt',
      label: 'Alt Text',
      type: 'text',
      required: true,
      admin: {
        description: 'Screen-reader alternative text',
      },
    },
    {
      name: 'description',
      label: 'Description',
      type: 'richText',
      admin: {
        description: 'Optional context displayed with the media asset',
      },
    },
    {
      name: 'clinic',
      label: 'Clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: {
        description: 'Owning clinic',
        condition: (_data, _siblingData, { user }) =>
          !(user && user.collection === 'basicUsers' && user.userType === 'clinic'),
      },
    },
    {
      name: 'status',
      label: 'Status',
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
      label: 'Published At',
      type: 'date',
      admin: {
        description: 'Timestamp automatically set when media is published',
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'createdBy',
      label: 'Created By',
      type: 'relationship',
      relationTo: 'basicUsers',
      required: true,
      admin: {
        description: 'Who performed the upload (auto-set)',
        readOnly: true,
        position: 'sidebar',
        condition: () => false,
      },
    },
    {
      name: 'storageKey',
      label: 'Storage Key',
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
      label: 'Storage Path',
      type: 'text',
      required: true,
      admin: {
        description: 'Resolved storage path used in storage',
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: 'prefix',
      label: 'Storage Prefix',
      type: 'text',
      admin: {
        hidden: true,
        readOnly: true,
        description: 'S3 storage prefix (managed by plugin)',
      },
      access: {
        read: () => true,
        update: () => false,
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
