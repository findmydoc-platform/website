import { CollectionConfig } from 'payload'

export const Threatments: CollectionConfig = {
  slug: 'threatments',
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
      name: 'Description',
      type: 'text',
      required: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      hasMany: true,
      admin: {
        description: 'Categories of this threatment',
      },
    },
  ],
}
