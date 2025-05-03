import { CollectionConfig } from 'payload'
import { slugField } from '@/fields/slug'
import { languageOptions } from './common/selectionOptions'

export const Clinics: CollectionConfig = {
  slug: 'clinics',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'country'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of the clinic',
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: {
        description: 'Link this clinic to one or more Tags',
      },
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'Detailed description of the clinic',
      },
    },
    {
      name: 'address',
      type: 'group',
      admin: {
        description: 'Clinic address information',
      },
      fields: [
        {
          name: 'street',
          type: 'text',
          required: true,
          admin: {
            description: 'Street name',
          },
        },
        {
          name: 'houseNumber',
          type: 'text',
          required: true,
          admin: {
            description: 'House number',
          },
        },
        {
          name: 'zipCode',
          type: 'number',
          required: true,
          admin: {
            description: 'Zip code of clinic',
          },
        },
        {
          name: 'city',
          type: 'relationship',
          relationTo: 'cities',
          required: true,
          admin: {
            description: 'City where the clinic is located',
          },
        },
        {
          name: 'country',
          type: 'text',
          required: true,
          defaultValue: 'Turkey',
          admin: {
            description: 'Country where the clinic is located',
          },
        },
        {
          name: 'coordinates',
          type: 'point',
          admin: {
            description: 'Coordinates for Google Maps',
          },
        },
      ],
    },
    {
      name: 'contact',
      type: 'group',
      admin: {
        description: 'Clinic contact information',
      },
      fields: [
        {
          name: 'phoneNumber',
          type: 'text',
          required: true,
          admin: {
            description: 'Phone number',
          },
        },
        {
          name: 'email',
          type: 'email',
          required: true,
          admin: {
            description: 'Email address',
          },
        },
        {
          name: 'website',
          type: 'text',
          admin: {
            description: 'Website URL',
          },
          validate: (val: string | string[] | null | undefined) => {
            if (val && typeof val === 'string' && !val.match(/^https?:\/\/.+\..+$/)) {
              return 'Please enter a valid URL starting with http:// or https://'
            }
            return true
          },
        },
      ],
    },
    {
      name: 'accreditations',
      type: 'relationship',
      relationTo: 'accreditation',
      hasMany: true,
      admin: {
        description: 'Accreditations held by this clinic',
      },
    },
    {
      name: 'averageRating',
      type: 'number',
      min: 0,
      max: 5,
      admin: {
        description: 'Average rating of the clinic (computed from reviews)',
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      defaultValue: 'draft',
      required: true,
      admin: {
        description: 'Current status of this clinic listing',
      },
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
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Clinic thumbnail image',
      },
    },
    ...slugField('name'), // Add slug field that uses the 'name' field as source
  ],
  timestamps: true,
}
