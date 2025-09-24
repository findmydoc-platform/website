import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { isClinicBasicUser } from '@/access/isClinicBasicUser'
import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'
import { beforeChangeClinicMedia } from './hooks/beforeChangeClinicMedia'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const ClinicMedia: CollectionConfig = {
  slug: 'clinicMedia',
  admin: {
    group: 'Content & Media',
    description: 'Clinic-owned images and files (scoped by clinic)',
    defaultColumns: ['clinic', 'alt', 'createdBy'],
  },
  access: {
    read: anyone,
    create: async ({ req, data }) => {
      // Platform can always create
      if (isPlatformBasicUser({ req })) return true

      // Clinic staff can create only for their assigned clinic
      if (isClinicBasicUser({ req })) {
        // Prefer fast path if test/user object includes clinicId (used in unit tests)
        const userClinicId = (req.user as any)?.clinicId ?? (await getUserAssignedClinicId(req.user, req.payload))
        const clinicFromData =
          typeof (data as any)?.clinic === 'object' ? (data as any).clinic?.id : (data as any)?.clinic
        return Boolean(userClinicId && clinicFromData && String(userClinicId) === String(clinicFromData))
      }
      return false
    },
    update: async ({ req }) => {
      // Platform can update all
      if (isPlatformBasicUser({ req })) return true

      // Clinic staff: scope to their clinic
      if (isClinicBasicUser({ req })) {
        const clinicId = await getUserAssignedClinicId(req.user, req.payload)
        if (clinicId) {
          return { clinic: { equals: clinicId } }
        }
      }
      return false
    },
    delete: async ({ req }) => {
      // Platform can delete all
      if (isPlatformBasicUser({ req })) return true

      // Clinic staff: scope to their clinic
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
      admin: { description: 'Alternative text for screen readers' },
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
      admin: { description: 'Uploader (auto-set)' },
    },
    {
      name: 'storagePath',
      type: 'text',
      required: true,
      admin: { description: 'Resolved storage path hint', readOnly: true },
    },
  ],
  upload: {
    staticDir: path.resolve(dirname, '../../public/clinic-media'),
    adminThumbnail: 'thumbnail',
    focalPoint: true,
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
