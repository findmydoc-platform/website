import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { clinicMediaReadAccess } from '@/access/clinicMediaRead'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { beforeChangeAssignClinicFromUser } from '@/hooks/clinicOwnership'
import { beforeChangeFreezeRelation } from '@/hooks/ownership'
import { beforeChangeCreatedBy } from '@/hooks/createdBy'
import { beforeChangeComputeStorage } from '@/hooks/media/computeStorage'
import { afterErrorLogMediaUploadError, beforeOperationCaptureMediaUpload } from '@/hooks/media/uploadLogging'
import { beforeOperationPrepareUploadFilename } from '@/hooks/media/prepareUploadFilename'
import { beforeOperationValidateMediaUpload } from '@/hooks/media/validateMediaUpload'
import { beforeOperationNormalizeClinicMediaUpload } from '@/hooks/media/normalizeClinicMediaUpload'
import { computedOnlyFieldAccess } from '@/access/fieldAccess'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'
import {
  buildMediaAltField,
  buildMediaCaptionField,
  buildMediaCreatedByField,
  buildMediaPrefixField,
  buildMediaStoragePathField,
  buildMediaUploadConfig,
  clinicProfileMediaImageMimeTypes,
} from '@/collections/common/mediaCollection'
import { beforeChangeValidatePublishedClinicMedia } from './publicationStatus'
import { beforeDeleteRejectReferencedClinicMedia } from './deletionGuard'
import { revalidateClinicMediaChange } from '@/hooks/revalidateClinicSurfaces'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const ClinicMedia: CollectionConfig = {
  slug: 'clinicMedia',
  admin: {
    group: 'Clinics',
    description: 'Clinic images and files',
    defaultColumns: ['clinic', 'status', 'alt', 'createdBy'],
    components: {
      edit: {
        Upload: '@/app/(payload)/components/PolicyAwareUpload',
      },
    },
  },
  access: {
    read: clinicMediaReadAccess,
    create: isPlatformStaff,
    update: isPlatformStaff,
    delete: isPlatformStaff,
  },
  trash: true,
  hooks: {
    afterChange: [revalidateClinicMediaChange],
    afterError: [afterErrorLogMediaUploadError],
    beforeChange: [
      stableIdBeforeChangeHook,
      beforeChangeAssignClinicFromUser({ clinicField: 'clinic' }),
      beforeChangeFreezeRelation({
        relationField: 'clinic',
        message: 'Clinic ownership cannot be changed once set',
      }),
      beforeChangeCreatedBy({ createdByField: 'createdBy' }),
      beforeChangeComputeStorage({
        ownerField: 'clinic',
        key: { type: 'docId' },
        storagePrefix: 'clinics',
      }),
      beforeChangeValidatePublishedClinicMedia,
    ],
    beforeDelete: [beforeDeleteRejectReferencedClinicMedia],
    beforeOperation: [
      beforeOperationValidateMediaUpload,
      beforeOperationNormalizeClinicMediaUpload,
      beforeOperationPrepareUploadFilename,
      beforeOperationCaptureMediaUpload({
        ownerField: 'clinic',
        storagePrefix: 'clinics',
      }),
    ],
  },
  fields: [
    stableIdField(),
    buildMediaAltField({ required: false }),
    buildMediaCaptionField(),
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      index: true,
      required: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      access: {
        create: computedOnlyFieldAccess,
        update: computedOnlyFieldAccess,
      },
      admin: {
        description: 'Technical visibility state managed by the clinic gallery.',
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: {
        description: 'Clinic that owns this media',
        condition: (_data, _siblingData, { user }) => !(user && user.collection === 'clinicStaff'),
      },
    },
    buildMediaCreatedByField({
      relationTo: ['platformStaff', 'clinicStaff'],
    }),
    buildMediaStoragePathField(),
    buildMediaPrefixField(),
  ],
  upload: buildMediaUploadConfig({
    mimeTypes: clinicProfileMediaImageMimeTypes,
    staticDir: path.resolve(dirname, '../../public/clinic-media'),
  }),
  indexes: [
    {
      fields: ['clinic', 'status', 'createdAt'],
    },
  ],
}
