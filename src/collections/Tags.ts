import { CollectionConfig } from 'payload'
import { slugField } from '@/fields/slug'

export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: {
    singular: 'Tag',
    plural: 'Tags',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug'],
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
    // generate slug from 'name', readOnly, with lock toggle in sidebar
    ...slugField('name', {}),
    {
      name: 'posts',
      type: 'join',
      collection: 'posts',
      on: 'tags',
      admin: {
        defaultColumns: ['title'],
        description: 'Link this tag to one or more Posts',
        allowCreate: false,
      },
    },
    {
      name: 'clinics',
      type: 'join',
      collection: 'clinics',
      on: 'tags',
      admin: {
        defaultColumns: ['name'],
        description: 'Link this tag to one or more Clinics',
        allowCreate: false,
      },
    },
    {
      name: 'treatments',
      type: 'join',
      collection: 'treatments',
      on: 'tags',
      admin: {
        defaultColumns: ['name'],
        description: 'Link this tag to one or more Treatments',
        allowCreate: false,
      },
    },
  ],
}
