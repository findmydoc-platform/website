import { executeRevalidationPlan, planRevalidation } from '@/utilities/cacheRevalidation'
import { slugField } from '@/fields/slugField'
import { isDeepStrictEqual } from 'node:util'
import type { CollectionConfig, PayloadRequest } from 'payload'
import { text as validateText, type TextFieldSingleValidation } from 'payload/shared'

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

const validateCategoryTitle: TextFieldSingleValidation = (value, options) => {
  // Nested Docs saves shared breadcrumbs in the active locale, even if the child is untranslated.
  if (options.operation === 'update' && value == null && options.previousValue == null) return true
  return validateText(value, options)
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
    beforeChange: [
      stableIdBeforeChangeHook,
      ({ data, originalDoc }) => {
        delete data.titleSearch
        data.titleRevision = (originalDoc?.titleRevision ?? 0) + 1
        return data
      },
    ],
    afterChange: [
      ({ doc, operation, previousDoc, req }) => {
        if (operation === 'update' && !isDeepStrictEqual(doc.title, previousDoc?.title)) {
          revalidateCategory(req, doc.id, 'update')
        }
      },
    ],
    afterDelete: [({ doc, req }) => revalidateCategory(req, doc.id, 'delete')],
  },
  admin: {
    group: 'Content & Media',
    useAsTitle: 'titleSearch',
    defaultColumns: ['titleSearch', 'slug'],
    listSearchableFields: ['titleSearch'],
    description: 'Categories for blog posts',
  },
  fields: [
    stableIdField(),
    {
      name: 'title',
      type: 'text',
      localized: true,
      required: true,
      validate: validateCategoryTitle,
      admin: {
        description: 'Category name',
      },
    },
    {
      name: 'titleSearch',
      type: 'text',
      admin: { condition: () => false },
    },
    {
      name: 'titleRevision',
      type: 'number',
      admin: { condition: () => false },
    },
    slugField(),
  ],
}
