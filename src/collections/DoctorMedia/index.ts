import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { isClinicBasicUser } from '@/access/isClinicBasicUser'
import { getUserAssignedClinicId, normalizeClinicId } from '@/access/utils/getClinicAssignment'
import { platformOrOwnClinicResource } from '@/access/scopeFilters'
import { getDoctorClinicId } from '@/access/utils/getDoctorClinic'
import { extractRelationId } from '@/collections/common/mediaPathHelpers'
import { beforeChangeDoctorMedia } from './hooks/beforeChangeDoctorMedia'
import type { DoctorMedia as DoctorMediaType } from '@/payload-types'
import { afterErrorLogMediaUploadError, beforeOperationCaptureMediaUpload } from '@/hooks/media/uploadLogging'
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
  },
  access: {
    read: platformOrOwnClinicResource,
    // Custom create logic: we must ensure the doctor provided actually belongs to the clinic of the
    // uploading clinic staff user (or platform). This cross-entity validation (doctor -> clinic)
    // goes beyond the simple clinic scoping handled by platformOrOwnClinicResource, so we keep a
    // bespoke create handler here.
    create: async ({ req, data }) => {
      if (isPlatformBasicUser({ req })) return true

      if (isClinicBasicUser({ req })) {
        const clinicId = await getUserAssignedClinicId(req.user, req.payload)
        const mediaData = data as Partial<DoctorMediaType>
        const doctorId = extractRelationId(mediaData?.doctor)
        if (!clinicId || !doctorId) return false

        const doctorClinic = await getDoctorClinicId(doctorId, req.payload)
        const normalizedClinic = normalizeClinicId(clinicId)
        const normalizedDoctorClinic = normalizeClinicId(doctorClinic)

        return Boolean(
          normalizedClinic !== null && normalizedDoctorClinic !== null && normalizedDoctorClinic === normalizedClinic,
        )
      }

      return false
    },
    update: platformOrOwnClinicResource,
    delete: platformOrOwnClinicResource,
  },
  trash: true,
  hooks: {
    afterError: [afterErrorLogMediaUploadError],
    beforeChange: [beforeChangeDoctorMedia],
    beforeOperation: [
      beforeOperationCaptureMediaUpload({
        ownerField: 'doctor',
        storagePrefix: 'doctors',
      }),
    ],
  },
  fields: [
    buildMediaAltField(),
    buildMediaCaptionField(),
    {
      name: 'doctor',
      type: 'relationship',
      relationTo: 'doctors',
      required: true,
      index: true,
      admin: { description: 'Select a doctor' },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: { description: 'Clinic for this doctor', readOnly: true },
    },
    buildMediaCreatedByField({
      relationTo: 'basicUsers',
    }),
    buildMediaStoragePathField(),
    buildMediaPrefixField(),
  ],
  upload: buildMediaUploadConfig({
    staticDir: path.resolve(dirname, '../../public/doctor-media'),
  }),
}
