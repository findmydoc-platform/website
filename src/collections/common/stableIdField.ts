import type { Field } from 'payload'
import { randomUUID } from 'crypto'
import { beforeChangeImmutableField } from '@/hooks/immutability'

export const stableIdField = (): Field => ({
  name: 'stableId',
  type: 'text',
  unique: true,
  index: true,
  admin: {
    hidden: true,
  },
  hooks: {
    beforeValidate: [
      ({ value }) => {
        if (typeof value === 'string' && value.length > 0) {
          return value
        }
        return randomUUID()
      },
    ],
  },
})

export const stableIdBeforeChangeHook = beforeChangeImmutableField({
  field: 'stableId',
})
