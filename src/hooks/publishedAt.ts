/**
 * Normalizes `publishedAt` based on a status field transition.
 *
 * Rules:
 * - When status transitions into the `publishedValue`, set publishedAt (if absent) to now.
 * - When status transitions out of the `publishedValue`, set publishedAt to null (if absent in draft).
 * - Otherwise carry over existing publishedAt when draft omits it.
 *
 * @param draft - Mutable draft document
 * @param originalDoc - Previous document state (if any)
 * @param statusKey - Field name for status (default: 'status')
 * @param publishedAtKey - Field name for publishedAt (default: 'publishedAt')
 * @param publishedValue - Published status value (default: 'published')
 */
// (kept for reference inline in the hook below)

/**
 * Reusable beforeChange hook for normalizing publishedAt based on a status field.
 */
export function beforeChangePublishedAt(options?: {
  statusKey?: string
  publishedAtKey?: string
  publishedValue?: string
}) {
  const { statusKey = 'status', publishedAtKey = 'publishedAt', publishedValue = 'published' } = options || {}
  return async ({ data, originalDoc }: { data: any; originalDoc?: any }) => {
    const draft: any = { ...(data || {}) }
    const nextStatus = draft?.[statusKey] ?? originalDoc?.[statusKey] ?? 'draft'
    draft[statusKey] = nextStatus
    const previousStatus = originalDoc?.[statusKey] ?? 'draft'

    if (nextStatus === publishedValue && previousStatus !== publishedValue) {
      draft[publishedAtKey] = draft[publishedAtKey] ?? new Date().toISOString()
    } else if (nextStatus !== publishedValue && previousStatus === publishedValue) {
      draft[publishedAtKey] = draft[publishedAtKey] ?? null
    } else if (draft[publishedAtKey] === undefined && originalDoc?.[publishedAtKey] !== undefined) {
      draft[publishedAtKey] = originalDoc[publishedAtKey]
    }
    return draft
  }
}
