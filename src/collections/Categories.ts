import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { isPlatformBasicUser } from '../access/isPlatformBasicUser'
import { slugField } from '@/fields/slug'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: isPlatformBasicUser,
    delete: isPlatformBasicUser,
    read: anyone,
    update: isPlatformBasicUser,
  },
  admin: {
    group: 'Content & Media',
    useAsTitle: 'title',
    description: 'Post categories for organising blog content',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Category title displayed in the blog',
      },
    },
    ...slugField(),
  ],
}
