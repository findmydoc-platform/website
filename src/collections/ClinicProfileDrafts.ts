import type { CollectionConfig } from 'payload'

import { isPlatformStaff } from '@/access/isPlatformStaff'
import { languageOptions } from './common/selectionOptions'
import { draftOpeningHoursField } from './clinics/openingHours'

export const ClinicProfileDrafts: CollectionConfig = {
  slug: 'clinicProfileDrafts',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'name',
    defaultColumns: ['clinic', 'revision', 'basePublishedRevision', 'updatedAt'],
    description: 'Private clinic profile drafts managed through the Clinic Dashboard API',
  },
  access: {
    create: isPlatformStaff,
    read: isPlatformStaff,
    update: isPlatformStaff,
    delete: isPlatformStaff,
  },
  indexes: [
    {
      fields: ['clinic'],
      unique: true,
    },
  ],
  fields: [
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
    },
    {
      name: 'basePublishedRevision',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'revision',
      type: 'number',
      required: true,
      min: 1,
    },
    {
      name: 'name',
      type: 'text',
      maxLength: 180,
    },
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'supportedLanguages',
      type: 'select',
      hasMany: true,
      options: languageOptions,
    },
    {
      name: 'address',
      type: 'group',
      fields: [
        {
          name: 'country',
          type: 'relationship',
          relationTo: 'countries',
          required: true,
        },
        {
          name: 'street',
          type: 'text',
          maxLength: 200,
        },
        {
          name: 'houseNumber',
          type: 'text',
          maxLength: 40,
        },
        {
          name: 'zipCode',
          type: 'text',
          maxLength: 32,
        },
        {
          name: 'city',
          type: 'relationship',
          relationTo: 'cities',
        },
      ],
    },
    draftOpeningHoursField,
  ],
}
