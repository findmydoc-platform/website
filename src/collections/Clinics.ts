import { CollectionConfig } from 'payload'

export const Clinics: CollectionConfig = {
  slug: 'clinics',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['klinikId', 'name', 'city', 'country'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'klinikId',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Unique identifier for the clinic',
      },
    },
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
      name: 'assignedDoctors',
      type: 'relationship',
      relationTo: 'doctors',
      hasMany: true,
      admin: {
        description: 'Doctors working at this clinic',
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
      name: 'location',
      type: 'group',
      fields: [
        {
          name: 'latitude',
          type: 'number',
          required: true,
          min: -90,
          max: 90,
        },
        {
          name: 'longitude',
          type: 'number',
          required: true,
          min: -180,
          max: 180,
        },
      ],
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
  ],
  timestamps: true,
}
