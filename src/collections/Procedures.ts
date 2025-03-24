import { CollectionConfig } from 'payload'

export const Procedures: CollectionConfig = {
  slug: 'procedures',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'description'],
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
      name: 'short',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'text',
      required: true,
    },
  ],
}
