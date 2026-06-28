import { getCurrentIsoTimestampString } from '@/utilities/timestamps'

/**
 * Normalizes `publishedAt` as the first-publication timestamp for a status field.
 *
 * Rules:
 * - When status transitions into the `publishedValue`, set publishedAt (if absent) to now.
 * - When status transitions out of the `publishedValue`, keep any existing publishedAt value.
 * - When status stays published, keep the existing value unless a replacement is provided.
 *
 * @param statusKey - Field name for status (default: 'status')
 * @param publishedAtKey - Field name for publishedAt (default: 'publishedAt')
 * @param publishedValue - Published status value (default: 'published')
 */
export function beforeChangePublishedAt(options?: {
  statusKey?: string
  publishedAtKey?: string
  publishedValue?: string
}) {
  const { statusKey = 'status', publishedAtKey = 'publishedAt', publishedValue = 'published' } = options || {}
  return async ({ data, originalDoc }: { data: Record<string, unknown>; originalDoc?: Record<string, unknown> }) => {
    const draft: Record<string, unknown> = { ...(data || {}) }
    const nextStatus = draft?.[statusKey] ?? originalDoc?.[statusKey] ?? 'draft'
    draft[statusKey] = nextStatus
    const previousStatus = originalDoc?.[statusKey] ?? 'draft'
    const previousPublishedAt = originalDoc?.[publishedAtKey]
    const incomingPublishedAt = draft[publishedAtKey]
    const hasIncomingPublishedAt =
      incomingPublishedAt !== undefined && incomingPublishedAt !== null && incomingPublishedAt !== ''
    const hasPreviousPublishedAt =
      previousPublishedAt !== undefined && previousPublishedAt !== null && previousPublishedAt !== ''

    if (nextStatus === publishedValue && previousStatus !== publishedValue) {
      if (hasIncomingPublishedAt) {
        draft[publishedAtKey] = incomingPublishedAt
      } else if (hasPreviousPublishedAt) {
        draft[publishedAtKey] = previousPublishedAt
      } else {
        draft[publishedAtKey] = getCurrentIsoTimestampString()
      }
    } else if (nextStatus !== publishedValue && previousStatus === publishedValue) {
      if (!hasIncomingPublishedAt && hasPreviousPublishedAt) {
        draft[publishedAtKey] = previousPublishedAt
      }
    } else if (!hasIncomingPublishedAt && hasPreviousPublishedAt) {
      draft[publishedAtKey] = previousPublishedAt
    }
    return draft
  }
}
