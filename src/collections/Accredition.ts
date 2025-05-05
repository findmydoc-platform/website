import { CollectionConfig } from 'payload'

export const Accredition: CollectionConfig = {
  slug: 'accreditation',
  admin: {
    group: 'Platform Management',
    useAsTitle: 'name',
    defaultColumns: ['name', 'abbreviation'],
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
      name: 'abbreviation',
      type: 'text',
      required: true,
    },
    {
      name: 'country',
      type: 'text',
      required: true,
      admin: {
        description: 'Country where the accreditation is from',
      },
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'Description of the accreditation',
      },
      required: true,
    },
    {
      name: 'icon',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
  ],
}
