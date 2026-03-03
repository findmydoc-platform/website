import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { clinicMediaReadAccess } from '@/access/clinicMediaRead'
import { platformOrAssignedClinicMutation, platformOrOwnClinicResource } from '@/access/scopeFilters'
import { beforeChangeAssignClinicFromUser } from '@/hooks/clinicOwnership'
import { beforeChangeFreezeRelation } from '@/hooks/ownership'
import { beforeChangeCreatedBy } from '@/hooks/createdBy'
import { beforeChangeComputeStorage } from '@/hooks/media/computeStorage'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']

export const ClinicMedia: CollectionConfig = {
  slug: 'clinicMedia',
  admin: {
    group: 'Clinics',
    description: 'Clinic-owned images and files with strict clinic scoping',
    defaultColumns: ['clinic', 'alt', 'createdBy'],
  },
  access: {
    read: clinicMediaReadAccess,
    create: platformOrAssignedClinicMutation,
    update: platformOrOwnClinicResource,
    delete: platformOrOwnClinicResource,
  },
  trash: true,
  hooks: {
    beforeChange: [
      stableIdBeforeChangeHook,
      beforeChangeAssignClinicFromUser({ clinicField: 'clinic' }),
      beforeChangeFreezeRelation({
        relationField: 'clinic',
        message: 'Clinic ownership cannot be changed once set',
      }),
      beforeChangeCreatedBy({ createdByField: 'createdBy', userCollection: 'basicUsers' }),
      beforeChangeComputeStorage({
        ownerField: 'clinic',
        key: { type: 'docId' },
        storagePrefix: 'clinics',
      }),
    ],
  },
  fields: [
    stableIdField(),
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: { description: 'Screen-reader alternative text' },
    },
    {
      name: 'caption',
      type: 'richText',
      required: false,
      admin: { description: 'Optional caption displayed with the media' },
    },
    {
      name: 'clinic',
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
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'basicUsers',
      required: true,
      admin: {
        description: 'Who performed the upload (auto-set)',
        condition: () => false,
      },
    },
    {
      name: 'storagePath',
      type: 'text',
      required: true,
      admin: { description: 'Resolved storage path used in storage', readOnly: true, hidden: true },
    },
    {
      name: 'prefix',
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
    staticDir: path.resolve(dirname, '../../public/clinic-media'),
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
