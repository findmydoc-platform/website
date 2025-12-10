import type { CollectionConfig } from 'payload'

import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { isClinicBasicUser } from '@/access/isClinicBasicUser'
import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'
import { clinicGalleryReadAccess, clinicGalleryScopedMutationAccess } from '@/access/clinicGallery'
import { beforeChangeClinicGalleryEntry } from './hooks/beforeChangeClinicGalleryEntry'
import { beforeChangeFreezeRelation } from '@/hooks/ownership'
import { beforeChangeCreatedBy } from '@/hooks/createdBy'
import { beforeChangePublishedAt } from '@/hooks/publishedAt'
import type { ClinicGalleryEntry } from '@/payload-types'

export const ClinicGalleryEntries: CollectionConfig = {
  slug: 'clinicGalleryEntries',
  admin: {
    group: 'Clinics',
    defaultColumns: ['clinic', 'status', 'title', 'createdBy'],
    description: 'Curated before/after stories composed from clinic gallery media',
    useAsTitle: 'title',
  },
  access: {
    read: clinicGalleryReadAccess,
    create: async ({ req, data }) => {
      if (isPlatformBasicUser({ req })) return true

      if (isClinicBasicUser({ req })) {
        const clinicId = await getUserAssignedClinicId(req.user, req.payload)
        const entryData = data as Partial<ClinicGalleryEntry>
        const targetClinic = typeof entryData?.clinic === 'object' ? entryData.clinic?.id : entryData?.clinic
        return Boolean(clinicId && targetClinic && String(clinicId) === String(targetClinic))
      }

      return false
    },
    update: clinicGalleryScopedMutationAccess,
    delete: clinicGalleryScopedMutationAccess,
  },
  hooks: {
    beforeChange: [
      beforeChangeFreezeRelation({
        relationField: 'clinic',
        message: 'Clinic ownership cannot be changed once set',
      }),
      beforeChangeCreatedBy({ createdByField: 'createdBy', userCollection: 'basicUsers' }),
      beforeChangeClinicGalleryEntry,
      beforeChangePublishedAt({
        statusKey: 'status',
        publishedAtKey: 'publishedAt',
        publishedValue: 'published',
      }),
    ],
  },
  fields: [
    {
      name: 'clinic',
      label: 'Clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: {
        description: 'Owning clinic',
      },
    },
    {
      name: 'title',
      label: 'Title',
      type: 'text',
      required: true,
      admin: {
        description: 'Internal title used to identify this gallery entry',
      },
    },
    {
      name: 'beforeMedia',
      label: 'Before Media',
      type: 'relationship',
      relationTo: 'clinicGalleryMedia',
      required: true,
      admin: {
        description: 'Published gallery media representing the before state',
      },
    },
    {
      name: 'afterMedia',
      label: 'After Media',
      type: 'relationship',
      relationTo: 'clinicGalleryMedia',
      required: true,
      admin: {
        description: 'Published gallery media representing the after state',
      },
    },
    {
      name: 'description',
      label: 'Description',
      type: 'richText',
      admin: {
        description: 'Optional story or description shown with the gallery entry',
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
        description: 'Only published entries are visible to patients and anonymous visitors',
      },
    },
    {
      name: 'publishedAt',
      label: 'Published At',
      type: 'date',
      admin: {
        description: 'Timestamp automatically set when the entry is published',
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
        description: 'Who curated the entry (auto-set)',
        readOnly: true,
        position: 'sidebar',
      },
    },
  ],
}
