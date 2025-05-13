import type { CheckboxField, TextField, Field } from 'payload'
import { formatSlugHook } from './formatSlug'

type Slug = (fieldToUse?: string, ensureUnique?: boolean) => Field[]

export const slugField: Slug = (fieldToUse = 'title', ensureUnique = false) => {
  const checkBoxField: CheckboxField = {
    name: 'slugLock',
    type: 'checkbox',
    defaultValue: true,
    admin: {
      hidden: true,
      position: 'sidebar',
    },
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
    unique: ensureUnique,
  }

  return [slugGeneratedField, checkBoxField]
}
