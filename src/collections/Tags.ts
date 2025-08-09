import { CollectionConfig } from 'payload'
import { slugField } from '@/fields/slug'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: {
    singular: 'Tag',
    plural: 'Tags',
  },
  admin: {
    group: 'Content & Media',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug'],
    description: 'Keywords used to categorize posts, clinics and treatments',
  },
  access: {
    read: anyone,
    create: isPlatformBasicUser,
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
  },
  timestamps: true,
  trash: true, // Enable soft delete - records are marked as deleted instead of permanently removed
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Tag label shown in the UI',
      },
    },
    // generate slug from 'name', readOnly, with lock toggle in sidebar
    ...slugField('name', true),
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
