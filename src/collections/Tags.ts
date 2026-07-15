import { CollectionConfig, slugField } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'

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
    description: 'Tags for posts, clinics, and treatments',
  },
  access: {
    read: anyone,
    create: isPlatformStaff,
    update: isPlatformStaff,
    delete: isPlatformStaff,
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook],
  },
  timestamps: true,
  trash: true, // Enable soft delete - records are marked as deleted instead of permanently removed
  fields: [
    stableIdField(),
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Tag name',
      },
    },
    // generate slug from 'name', readOnly, with lock toggle in sidebar
    slugField({
      fieldToUse: 'name',
    }),
    {
      name: 'posts',
      type: 'join',
      collection: 'posts',
      on: 'tags',
      admin: {
        defaultColumns: ['title'],
        description: 'Posts tagged with this tag',
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
        description: 'Clinics tagged with this tag',
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
        description: 'Treatments tagged with this tag',
        allowCreate: false,
      },
    },
  ],
}
