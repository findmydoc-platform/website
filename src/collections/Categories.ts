import type { CollectionConfig } from 'payload'
import { slugField } from 'payload'

import { anyone } from '../access/anyone'
import { isPlatformStaff } from '../access/isPlatformStaff'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: isPlatformStaff,
    delete: isPlatformStaff,
    read: anyone,
    update: isPlatformStaff,
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook],
  },
  admin: {
    group: 'Content & Media',
    useAsTitle: 'title',
    description: 'Categories for blog posts',
  },
  fields: [
    stableIdField(),
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Category name',
      },
    },
    slugField(),
  ],
}
