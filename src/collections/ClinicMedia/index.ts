import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { isClinicBasicUser } from '@/access/isClinicBasicUser'
import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'
import { beforeChangeClinicMedia } from './hooks/beforeChangeClinicMedia'

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
    read: async ({ req }) => {
      if (isPlatformBasicUser({ req })) return true

      if (isClinicBasicUser({ req })) {
        const clinicId = await getUserAssignedClinicId(req.user, req.payload)
        if (clinicId) {
          return { clinic: { equals: clinicId } }
        }
      }

      return false
    },
    create: async ({ req, data }) => {
      if (isPlatformBasicUser({ req })) return true

      if (isClinicBasicUser({ req })) {
        const userClinicId = (req.user as any)?.clinicId ?? (await getUserAssignedClinicId(req.user, req.payload))
        const clinicFromData =
          typeof (data as any)?.clinic === 'object' ? (data as any).clinic?.id : (data as any)?.clinic

        return Boolean(userClinicId && clinicFromData && String(userClinicId) === String(clinicFromData))
      }

      return false
    },
    update: async ({ req }) => {
      if (isPlatformBasicUser({ req })) return true

      if (isClinicBasicUser({ req })) {
        const clinicId = await getUserAssignedClinicId(req.user, req.payload)
        if (clinicId) {
          return { clinic: { equals: clinicId } }
        }
      }

      return false
    },
    delete: async ({ req }) => {
      if (isPlatformBasicUser({ req })) return true

      if (isClinicBasicUser({ req })) {
        const clinicId = await getUserAssignedClinicId(req.user, req.payload)
        if (clinicId) {
          return { clinic: { equals: clinicId } }
        }
      }

      return false
    },
  },
  trash: true,
  hooks: { beforeChange: [beforeChangeClinicMedia] },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: { description: 'Screen-reader alternative text' },
    },
    {
      name: 'caption',
      type: 'text',
      required: false,
      admin: { description: 'Optional caption displayed with the media' },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: { description: 'Owning clinic' },
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
