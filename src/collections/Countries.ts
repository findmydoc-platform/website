import { CollectionConfig } from 'payload'

export const Countries: CollectionConfig = {
  slug: 'countries',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'isoCode'],
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
      name: 'isoCode',
      type: 'text',
      required: true,
    },
    {
      name: 'language',
      type: 'text',
      required: true,
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
    },
  ],
}
