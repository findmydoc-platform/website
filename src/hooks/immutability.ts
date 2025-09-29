/**
 * Enforces immutability of a field after creation, with optional backfill from originalDoc.
 *
 * Behavior:
 * - On update: if both incoming and existing values are strings and differ, throws an Error.
 * - If incoming is missing and existing is present, copies existing into draft when backfill=true.
 *
 * @param operation - 'create' | 'update'
 * @param draft - Draft document (mutated in place)
 * @param originalDoc - Original persisted document
 * @param field - Field name to enforce immutability on
 * @param message - Optional custom error message
 * @param backfill - Whether to copy from original when missing (default: true)
 * @throws Error when field changes on update
 */
// (inlined inside the hook below)

/**
 * Reusable beforeChange hook enforcing immutability of a field with optional backfill.
 */
export function beforeChangeImmutableField(options: {
  field: string
  message?: string
  backfill?: boolean
}) {
  const { field, message, backfill = true } = options
  return async ({ data, originalDoc, operation }: { data: any; originalDoc?: any; operation: 'create' | 'update' }) => {
    const draft: any = { ...(data || {}) }
    const incoming = typeof draft?.[field] === 'string' ? draft[field] : null
    const existing = typeof originalDoc?.[field] === 'string' ? originalDoc[field] : null

    if (operation === 'update' && existing && incoming && incoming !== existing) {
      throw new Error(message ?? `${field} cannot be changed once set`)
    }

    if (!incoming && existing && backfill) {
      draft[field] = existing
    }
    return draft
  }
}
