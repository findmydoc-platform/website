import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { clinicMediaReadAccess } from '@/access/clinicMediaRead'
import { platformOrAssignedClinicMutation, platformOrOwnClinicResource } from '@/access/scopeFilters'
import { beforeChangeAssignClinicFromUser } from '@/hooks/clinicOwnership'
import { beforeChangeFreezeRelation } from '@/hooks/ownership'
import { beforeChangeCreatedBy } from '@/hooks/createdBy'
import { beforeChangeComputeStorage } from '@/hooks/media/computeStorage'
import { afterErrorLogMediaUploadError, beforeOperationCaptureMediaUpload } from '@/hooks/media/uploadLogging'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'
import {
  buildMediaAltField,
  buildMediaCaptionField,
  buildMediaCreatedByField,
  buildMediaPrefixField,
  buildMediaStoragePathField,
  buildMediaUploadConfig,
} from '@/collections/common/mediaCollection'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const ClinicMedia: CollectionConfig = {
  slug: 'clinicMedia',
  admin: {
    group: 'Clinics',
    description: 'Clinic images and files',
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
    afterError: [afterErrorLogMediaUploadError],
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
    beforeOperation: [
      beforeOperationCaptureMediaUpload({
        ownerField: 'clinic',
        storagePrefix: 'clinics',
      }),
    ],
  },
  fields: [
    stableIdField(),
    buildMediaAltField(),
    buildMediaCaptionField(),
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: {
        description: 'Select a clinic',
        condition: (_data, _siblingData, { user }) =>
          !(user && user.collection === 'basicUsers' && user.userType === 'clinic'),
      },
    },
    buildMediaCreatedByField({
      relationTo: 'basicUsers',
    }),
    buildMediaStoragePathField(),
    buildMediaPrefixField(),
  ],
  upload: buildMediaUploadConfig({
    staticDir: path.resolve(dirname, '../../public/clinic-media'),
  }),
}
