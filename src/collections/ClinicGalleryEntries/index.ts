import type { CollectionConfig } from 'payload'

import { clinicGalleryReadAccess, clinicGalleryScopedMutationAccess } from '@/access/clinicGallery'
import { platformOrAssignedClinicMutation } from '@/access/scopeFilters'
import { beforeChangeAssignClinicFromUser } from '@/hooks/clinicOwnership'
import { beforeChangeClinicGalleryEntry } from './hooks/beforeChangeClinicGalleryEntry'
import { beforeChangeFreezeRelation } from '@/hooks/ownership'
import { beforeChangeCreatedBy } from '@/hooks/createdBy'
import { beforeChangePublishedAt } from '@/hooks/publishedAt'

export const ClinicGalleryEntries: CollectionConfig = {
  slug: 'clinicGalleryEntries',
  admin: {
    group: 'Clinics',
    defaultColumns: ['clinic', 'status', 'title', 'createdBy'],
    description: 'Before-and-after stories built from clinic media',
    useAsTitle: 'title',
  },
  access: {
    read: clinicGalleryReadAccess,
    create: platformOrAssignedClinicMutation,
    update: clinicGalleryScopedMutationAccess,
    delete: clinicGalleryScopedMutationAccess,
  },
  hooks: {
    beforeChange: [
      beforeChangeAssignClinicFromUser({ clinicField: 'clinic' }),
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
        description: 'Clinic that owns this entry',
        condition: (_data, _siblingData, { user }) =>
          !(user && user.collection === 'basicUsers' && user.userType === 'clinic'),
      },
    },
    {
      name: 'title',
      label: 'Title',
      type: 'text',
      required: true,
      admin: {
        description: 'Short title for this story',
      },
    },
    {
      name: 'beforeMedia',
      label: 'Before Media',
      type: 'relationship',
      relationTo: 'clinicGalleryMedia',
      required: true,
      admin: {
        description: 'Media showing the before state',
      },
    },
    {
      name: 'afterMedia',
      label: 'After Media',
      type: 'relationship',
      relationTo: 'clinicGalleryMedia',
      required: true,
      admin: {
        description: 'Media showing the after state',
      },
    },
    {
      name: 'description',
      label: 'Description',
      type: 'richText',
      admin: {
        description: 'Short story shown with this entry',
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
        description: 'Visible only when published',
      },
    },
    {
      name: 'publishedAt',
      label: 'Published At',
      type: 'date',
      admin: {
        description: 'When this entry was published',
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
        description: 'Person who created this entry',
        readOnly: true,
        position: 'sidebar',
        condition: () => false,
      },
    },
  ],
}
