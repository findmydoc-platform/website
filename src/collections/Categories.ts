import { executeRevalidationPlan, planRevalidation } from '@/utilities/cacheRevalidation'
import { slugField } from '@/fields/slugField'
import type { CollectionConfig, PayloadRequest } from 'payload'

import { anyone } from '../access/anyone'
import { isPlatformStaff } from '../access/isPlatformStaff'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'

const revalidateCategory = (req: PayloadRequest, id: number | string, operation: 'update' | 'delete') => {
  if (req.context.disableRevalidate) return

  executeRevalidationPlan(
    planRevalidation({
      kind: 'category',
      operation,
      source: { kind: 'payload-hook', id: `categories:${id}` },
      subject: { id },
    }),
    { logger: req.payload.logger },
  )
}

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
    afterChange: [({ doc, req }) => revalidateCategory(req, doc.id, 'update')],
    afterDelete: [({ doc, req }) => revalidateCategory(req, doc.id, 'delete')],
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
      localized: true,
      required: true,
      admin: {
        description: 'Category name',
      },
    },
    slugField(),
  ],
}
