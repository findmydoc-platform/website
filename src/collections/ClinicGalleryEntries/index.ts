import type { CollectionConfig } from 'payload'

import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { isClinicBasicUser } from '@/access/isClinicBasicUser'
import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'
import { clinicGalleryReadAccess, clinicGalleryScopedMutationAccess } from '@/access/clinicGallery'
import { beforeChangeClinicGalleryEntry } from './hooks/beforeChangeClinicGalleryEntry'
import { beforeChangeFreezeRelation } from '@/hooks/ownership'
import { beforeChangeCreatedBy } from '@/hooks/createdBy'
import { beforeChangePublishedAt } from '@/hooks/publishedAt'

export const ClinicGalleryEntries: CollectionConfig = {
  slug: 'clinicGalleryEntries',
  admin: {
    group: 'Clinics',
    defaultColumns: ['clinic', 'variant', 'status', 'displayOrder'],
    description: 'Curated before/after gallery entries composed from clinic gallery media',
  },
  access: {
    read: clinicGalleryReadAccess,
    create: async ({ req, data }) => {
      if (isPlatformBasicUser({ req })) return true

      if (isClinicBasicUser({ req })) {
        const clinicId = await getUserAssignedClinicId(req.user, req.payload)
        const targetClinic =
          typeof (data as any)?.clinic === 'object' ? (data as any).clinic?.id : (data as any)?.clinic
        return Boolean(clinicId && targetClinic && String(clinicId) === String(targetClinic))
      }

      return false
    },
    update: clinicGalleryScopedMutationAccess,
    delete: clinicGalleryScopedMutationAccess,
  },
  hooks: {
    beforeChange: [
      beforeChangeFreezeRelation({ relationField: 'clinic', message: 'Clinic ownership cannot be changed once set' }),
      beforeChangeCreatedBy({ createdByField: 'createdBy', userCollection: 'basicUsers' }),
      beforeChangeClinicGalleryEntry,
      beforeChangePublishedAt({ statusKey: 'status', publishedAtKey: 'publishedAt', publishedValue: 'published' }),
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
      name: 'variant',
      label: 'Display Variant',
      type: 'select',
      required: true,
      defaultValue: 'single',
      options: [
        { label: 'Single image', value: 'single' },
        { label: 'Before / After pair', value: 'pair' },
      ],
      admin: {
        description: 'Choose between single highlight or paired comparison',
      },
    },
    {
      name: 'singleMedia',
      label: 'Single Media',
      type: 'relationship',
      relationTo: 'clinicGalleryMedia' as any,
      admin: {
        description: 'Published gallery media to display when variant = single',
        condition: (_data, siblingData) => siblingData?.variant !== 'pair',
      },
    },
    {
      name: 'beforeMedia',
      label: 'Before Media',
      type: 'relationship',
      relationTo: 'clinicGalleryMedia' as any,
      admin: {
        description: 'Published gallery media representing the before state',
        condition: (_data, siblingData) => siblingData?.variant === 'pair',
      },
    },
    {
      name: 'afterMedia',
      label: 'After Media',
      type: 'relationship',
      relationTo: 'clinicGalleryMedia' as any,
      admin: {
        description: 'Published gallery media representing the after state',
        condition: (_data, siblingData) => siblingData?.variant === 'pair',
      },
    },
    {
      name: 'treatment',
      label: 'Treatment',
      type: 'relationship',
      relationTo: 'treatments',
      admin: {
        description: 'Optional treatment associated with the result',
      },
    },
    {
      name: 'caption',
      label: 'Caption',
      type: 'richText',
      admin: {
        description: 'Short story or description shown with the gallery entry',
      },
    },
    {
      name: 'displayOrder',
      label: 'Display Order',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Lower numbers appear first when rendering the gallery',
        position: 'sidebar',
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
      name: 'consentReference',
      label: 'Consent Reference',
      type: 'text',
      admin: {
        description: 'Optional note or reference identifier for stored consent documents',
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
