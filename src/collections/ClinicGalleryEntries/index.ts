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
    description: 'Before-and-after stories',
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
        description: 'Clinic',
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
        description: 'Story title',
      },
    },
    {
      name: 'beforeMedia',
      label: 'Before Media',
      type: 'relationship',
      relationTo: 'clinicGalleryMedia',
      required: true,
      admin: {
        description: 'Before media',
      },
    },
    {
      name: 'afterMedia',
      label: 'After Media',
      type: 'relationship',
      relationTo: 'clinicGalleryMedia',
      required: true,
      admin: {
        description: 'After media',
      },
    },
    {
      name: 'description',
      label: 'Description',
      type: 'richText',
      admin: {
        description: 'Story text',
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
        description: 'Published only',
      },
    },
    {
      name: 'publishedAt',
      label: 'Published At',
      type: 'date',
      admin: {
        description: 'Published on',
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
        description: 'Created by',
        readOnly: true,
        position: 'sidebar',
        condition: () => false,
      },
    },
  ],
}
