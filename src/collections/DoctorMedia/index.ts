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

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']

export const DoctorMedia: CollectionConfig = {
  slug: 'doctorMedia',
  admin: {
    group: 'Medical Network',
    description: 'Doctor-owned images scoped by their clinic',
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
  hooks: { beforeChange: [beforeChangeDoctorMedia] },
  fields: [
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
      name: 'doctor',
      type: 'relationship',
      relationTo: 'doctors',
      required: true,
      index: true,
      admin: { description: 'Owning doctor' },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: { description: 'Clinic derived from the doctor', readOnly: true },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'basicUsers',
      required: true,
      admin: { description: 'Who performed the upload (auto-set)' },
    },
    {
      name: 'storagePath',
      type: 'text',
      required: true,
      admin: { description: 'Resolved storage path used in storage', readOnly: true },
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
    staticDir: path.resolve(dirname, '../../public/doctor-media'),
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
