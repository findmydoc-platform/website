import { CollectionConfig } from 'payload'

export const Treatments: CollectionConfig = {
  slug: 'treatments',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'description', 'averagePrice'],
  },
  access: {
    read: () => true,
  },
  timestamps: true,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: {
        description: 'Link this treatment to one or more Tags',
      },
    },
    {
      name: 'description',
      type: 'richText',
      required: true,
    },
    {
      name: 'medicalSpecialty',
      type: 'relationship',
      relationTo: 'medical-specialties',
      required: true,
    },

    {
      name: 'averagePrice',
      type: 'number',
      required: false,
      admin: {
        readOnly: true,
      },
    },
  ],
}
