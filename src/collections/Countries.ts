import { CollectionConfig } from 'payload'

export const Countries: CollectionConfig = {
  slug: 'countries',
  admin: {
    group: 'Location Data',
    useAsTitle: 'name',
    defaultColumns: ['name', 'isoCode'],
    description: 'Countries and regions where medical services are available. Used for organizing clinics, doctors, and patients by geographic location.',
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
