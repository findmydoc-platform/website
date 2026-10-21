import { beforeOperationNormalizeImageEdits } from '@/hooks/media/normalizeImageEdits'
import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { doctorMediaReadAccess } from '@/access/doctorMediaRead'
import {
  doctorSourceAccess,
  doctorMediaCreateAccess,
  guardDoctorOperation,
  guardDoctorChange,
  verifyDoctorOperation,
} from '@/features/doctorProfiles/authorization'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'
import { beforeChangeDoctorMedia } from './hooks/beforeChangeDoctorMedia'
import { afterErrorLogMediaUploadError, beforeOperationCaptureMediaUpload } from '@/hooks/media/uploadLogging'
import { beforeOperationPrepareUploadFilename } from '@/hooks/media/prepareUploadFilename'
import { beforeOperationValidateMediaUpload } from '@/hooks/media/validateMediaUpload'
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

export const DoctorMedia: CollectionConfig = {
  slug: 'doctorMedia',
  admin: {
    group: 'Medical Network',
    description: 'Doctor images tied to their clinic',
    defaultColumns: ['doctor', 'clinic', 'alt', 'createdBy'],
    components: {
      edit: {
        Upload: '@/app/(payload)/components/PolicyAwareUpload',
      },
    },
  },
  access: {
    read: doctorMediaReadAccess,
    create: doctorMediaCreateAccess,
    update: doctorSourceAccess(),
    delete: doctorSourceAccess(),
  },
  trash: true,
  hooks: {
    afterError: [afterErrorLogMediaUploadError],
    beforeChange: [stableIdBeforeChangeHook, guardDoctorChange, beforeChangeDoctorMedia],
    afterOperation: [verifyDoctorOperation],
    beforeOperation: [
      guardDoctorOperation,
      beforeOperationNormalizeImageEdits,
      beforeOperationValidateMediaUpload,
      beforeOperationPrepareUploadFilename,
      beforeOperationCaptureMediaUpload({
        ownerField: 'doctor',
        storagePrefix: 'doctors',
      }),
    ],
  },
  fields: [
    stableIdField(),
    buildMediaAltField(),
    buildMediaCaptionField(),
    {
      name: 'doctor',
      type: 'relationship',
      relationTo: 'doctors',
      required: true,
      index: true,
      admin: { description: 'Doctor that owns this media' },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: { description: 'Clinic where the doctor works', readOnly: true },
    },
    buildMediaCreatedByField({
      relationTo: ['platformStaff', 'clinicStaff'],
    }),
    buildMediaStoragePathField(),
    buildMediaPrefixField(),
  ],
  upload: buildMediaUploadConfig({
    staticDir: path.resolve(dirname, '../../public/doctor-media'),
  }),
}
