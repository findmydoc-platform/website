import type { Field } from 'payload'
import { randomUUID } from 'crypto'
import { beforeChangeImmutableField } from '@/hooks/immutability'

/**
 * Hidden, stable identifier for a document.
 *
 * - Auto-generated via `randomUUID()` during `beforeValidate` if missing.
 * - `unique` + `index` to support lookups and external references.
 * - Intended to never change after creation; enforce immutability by adding
 *   `stableIdBeforeChangeHook` to the collection's `hooks.beforeChange`.
 */
export const stableIdField = (): Field => ({
  name: 'stableId',
  type: 'text',
  unique: true,
  index: true,
  admin: {
    hidden: true,
    disableListColumn: true,
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

/**
 * Use alongside `stableIdField()` to prevent `stableId` from being modified after creation.
 *
 * To enforce immutability, add this hook to the collection's `hooks.beforeChange` array, e.g.:
 *
 * ```ts
 * hooks: {
 *   beforeChange: [stableIdBeforeChangeHook],
 * },
 * ```
 */
export const stableIdBeforeChangeHook = beforeChangeImmutableField({
  field: 'stableId',
})
