import type { CollectionConfig } from 'payload'
import { slugField } from 'payload'

import { anyone } from '../access/anyone'
import { isPlatformBasicUser } from '../access/isPlatformBasicUser'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: isPlatformBasicUser,
    delete: isPlatformBasicUser,
    read: anyone,
    update: isPlatformBasicUser,
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook],
  },
  admin: {
    group: 'Content & Media',
    useAsTitle: 'title',
    description: 'Post categories for organising blog content',
  },
  fields: [
    stableIdField(),
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Category title displayed in the blog (URL slug auto-generated from this field)',
      },
    },
    slugField(),
  ],
}
