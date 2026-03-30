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
import { beforeChangePublishedAt } from '@/hooks/publishedAt'
import { afterErrorLogMediaUploadError, beforeOperationCaptureMediaUpload } from '@/hooks/media/uploadLogging'
import {
  buildMediaAltField,
  buildMediaCaptionField,
  buildMediaCreatedByField,
  buildMediaPrefixField,
  buildMediaStoragePathField,
  buildMediaUploadConfig,
  galleryMediaImageMimeTypes,
} from '@/collections/common/mediaCollection'

const STORAGE_KEY_PREFIX = 'cgmedia'

const generateStorageKey = (): string => {
  const uniqueSegment = randomUUID().replace(/-/g, '')
  return `${STORAGE_KEY_PREFIX}-${uniqueSegment}`
}

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const ClinicGalleryMedia: CollectionConfig = {
  slug: 'clinicGalleryMedia',
  admin: {
    group: 'Clinics',
    description: 'Clinic gallery media',
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
    afterError: [afterErrorLogMediaUploadError],
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
    beforeOperation: [
      beforeOperationCaptureMediaUpload({
        ownerField: 'clinic',
        storagePrefix: 'clinics-gallery',
      }),
    ],
  },
  fields: [
    buildMediaAltField({
      label: 'Alt Text',
    }),
    buildMediaCaptionField({
      name: 'description',
      label: 'Description',
      description: 'Short note shown with the media',
    }),
    {
      name: 'clinic',
      label: 'Clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: {
        description: 'Clinic that owns this media',
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
        description: 'Visibility for clinic staff and patients',
      },
    },
    {
      name: 'publishedAt',
      label: 'Published At',
      type: 'date',
      admin: {
        description: 'When this media was published',
        readOnly: true,
        position: 'sidebar',
      },
    },
    buildMediaCreatedByField({
      relationTo: 'basicUsers',
      label: 'Created By',
      readOnly: true,
      position: 'sidebar',
    }),
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
    buildMediaStoragePathField({
      label: 'Storage Path',
    }),
    buildMediaPrefixField({
      label: 'Storage Prefix',
    }),
  ],
  upload: buildMediaUploadConfig({
    staticDir: path.resolve(dirname, '../../public/clinic-gallery-media'),
    mimeTypes: galleryMediaImageMimeTypes,
  }),
}
