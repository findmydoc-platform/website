import type { CheckboxField, TextField, Field } from 'payload/types'

import { formatSlugHook } from './formatSlug'

interface SlugFieldOptions {
  ensureUnique?: boolean
}

type Overrides = {
  slugOverrides?: Partial<TextField>
  checkboxOverrides?: Partial<CheckboxField>
}

type Slug = (fieldToUse?: string, overrides?: Overrides & SlugFieldOptions) => Field[]

export const slugField: Slug = (fieldToUse = 'title', overrides = {}) => {
  const { slugOverrides, checkboxOverrides, ensureUnique } = overrides

  const checkBoxField: CheckboxField = {
    name: 'slugLock',
    type: 'checkbox',
    defaultValue: true,
    admin: {
      hidden: true,
      position: 'sidebar',
    },
    ...checkboxOverrides,
  }

  const slugGeneratedField: TextField = {
    name: 'slug',
    type: 'text',
    index: true,
    label: 'Slug',
    hooks: {
      beforeValidate: [formatSlugHook(fieldToUse, { ensureUnique })],
    },
    admin: {
      position: 'sidebar',
      ...(slugOverrides?.admin || {}),
      components: {
        Field: {
          path: '@/fields/slug/SlugComponent#SlugComponent',
          clientProps: {
            fieldToUse,
            checkboxFieldPath: checkBoxField.name,
          },
        },
      },
    },
    ...(slugOverrides || {}),
    // property uniqueness is set 'true' if ensureUnique is true
    ...(ensureUnique && { unique: true }),
  }

  return [slugGeneratedField, checkBoxField]
}
