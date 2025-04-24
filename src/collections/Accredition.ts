import { CollectionConfig } from 'payload'
import { countries } from './common/selectionOptions'

export const Accredition: CollectionConfig = {
  slug: 'accreditation',
  admin: {
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
      type: 'select',
      options: countries,
      hasMany: false,
      required: true,
      admin: {
        description: 'Country where the accredition is from',
      },
    },
    {
      name: 'Description',
      type: 'text',
      required: true,
    },
  ],
}
