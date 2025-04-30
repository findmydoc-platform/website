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
    defaultColumns: ['name', 'slug', 'relatedTo'],
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
      name: 'relatedTo',
      type: 'relationship',
      relationTo: ['posts', 'clinics', 'treatments'],
      hasMany: true,
      admin: {
        description: 'Link this tag to one or more Posts, Clinics or Treatments',
      },
    },
  ],
}
