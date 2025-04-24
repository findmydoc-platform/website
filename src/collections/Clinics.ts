import { CollectionConfig } from 'payload'
import { slugField } from '@/fields/slug'
import { languageOptions } from './common/selectionOptions'

export const Clinics: CollectionConfig = {
  slug: 'clinics',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'city', 'country'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'foundingYear',
      type: 'number',
      required: true,
      min: 1800,
      max: new Date().getFullYear(),
      admin: {
        description: 'Year the clinic was founded',
      },
    },
    {
      name: 'country',
      type: 'text',
      required: true,
      admin: {
        description: 'Country where the clinic is located',
      },
    },
    {
      name: 'city',
      type: 'text',
      required: true,
    },
    {
      name: 'street',
      type: 'text',
      required: true,
    },
    {
      name: 'zipCode',
      type: 'text',
      required: true,
    },
    {
      name: 'supportedLanguages',
      type: 'select',
      options: languageOptions,
      hasMany: true,
      required: true,
      admin: {
        description: 'Languages supported by this clinic',
      },
    },
    {
      name: 'assignedAccreditations',
      type: 'relationship',
      relationTo: 'accreditation',
      hasMany: true,
      admin: {
        description: 'Accreditations held by this clinic',
      },
    },
    {
      name: 'offeredMedicalSpecialties',
      type: 'relationship',
      relationTo: 'medical-specialties',
      hasMany: true,
      admin: {
        description: 'Medical specialties held by this clinic',
      },
    },
    {
      name: 'assignedDoctors',
      type: 'relationship',
      relationTo: 'doctors',
      hasMany: true,
      admin: {
        description: 'Doctors working at this clinic',
      },
    },
    {
      name: 'assignedUsers',
      type: 'relationship',
      relationTo: 'plattformStaff',
      hasMany: true,
      admin: {
        description: 'Users associated with this clinic',
      },
    },
    {
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: {
        description: 'Clinic thumbnail image',
      },
    },
    {
      name: 'contact',
      type: 'group',
      fields: [
        {
          name: 'email',
          type: 'email',
          required: true,
        },
        {
          name: 'phone',
          type: 'text',
          required: true,
        },
        {
          name: 'website',
          type: 'text',
          validate: (val: string | string[] | null | undefined) => {
            if (typeof val === 'string' && !val.match(/^https?:\/\/.+\..+$/)) {
              return 'Please enter a valid URL starting with http:// or https://'
            }
            return true
          },
        },
      ],
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Is this clinic currently active?',
      },
    },
    ...slugField('name'), // Add slug field that uses the 'name' field as source
  ],
  timestamps: true,
}
