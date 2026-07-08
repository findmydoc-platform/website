import type { RevalidationExecutionResult, RevalidationFailure, RevalidationPlan } from './types'
import { normalizeRevalidationPlanIdentifiers } from './identifiers'

export const REVALIDATION_LOG_EVENTS = {
  planned: 'cache.revalidation.planned',
  executed: 'cache.revalidation.executed',
  failed: 'cache.revalidation.failed',
} as const

export type RevalidationLogEventName = (typeof REVALIDATION_LOG_EVENTS)[keyof typeof REVALIDATION_LOG_EVENTS]

const PREVIEW_LIMIT = 10

const preview = (values: readonly string[]) => ({
  values: values.slice(0, PREVIEW_LIMIT),
  truncated: values.length > PREVIEW_LIMIT,
})

const previewFailures = (failures: readonly RevalidationFailure[]) => ({
  values: failures.slice(0, PREVIEW_LIMIT).map((failure) => ({
    kind: failure.kind,
    identifier: failure.identifier,
    message: failure.message,
  })),
  truncated: failures.length > PREVIEW_LIMIT,
})

export const buildRevalidationLogPayload = ({
  eventName,
  plan,
  result,
}: {
  eventName: RevalidationLogEventName
  plan: RevalidationPlan
  result?: RevalidationExecutionResult
}): Record<string, unknown> => {
  const normalizedPlan = normalizeRevalidationPlanIdentifiers(plan)
  const isPrivateLive =
    normalizedPlan.emptyReason === 'private-live-noop' ||
    normalizedPlan.subject.kind === 'private-live' ||
    normalizedPlan.cacheClasses.includes('private-live')
  const tagPreview = preview(normalizedPlan.tags)
  const pathPreview = preview(normalizedPlan.paths)
  const failurePreview = previewFailures(result?.failures ?? [])

  return {
    event: eventName,
    operation: normalizedPlan.operation,
    source: {
      kind: normalizedPlan.logContext.sourceKind,
      ...(!isPrivateLive && normalizedPlan.logContext.sourceId ? { id: normalizedPlan.logContext.sourceId } : {}),
      ...(!isPrivateLive && normalizedPlan.logContext.correlationId
        ? { correlationId: normalizedPlan.logContext.correlationId }
        : {}),
    },
    subject: {
      kind: normalizedPlan.logContext.subjectKind,
      ...(!isPrivateLive && normalizedPlan.logContext.subjectId ? { id: normalizedPlan.logContext.subjectId } : {}),
      ...(!isPrivateLive && normalizedPlan.logContext.collection
        ? { collection: normalizedPlan.logContext.collection }
        : {}),
      ...(!isPrivateLive && normalizedPlan.logContext.global ? { global: normalizedPlan.logContext.global } : {}),
    },
    cacheClasses: [...normalizedPlan.cacheClasses],
    surfaceIds: [...normalizedPlan.surfaceIds],
    tagCount: normalizedPlan.tags.length,
    pathCount: normalizedPlan.paths.length,
    tagsPreview: tagPreview.values,
    pathsPreview: pathPreview.values,
    tagsTruncated: tagPreview.truncated,
    pathsTruncated: pathPreview.truncated,
    ...(normalizedPlan.emptyReason ? { emptyReason: normalizedPlan.emptyReason } : {}),
    ...(result
      ? {
          succeeded: result.succeeded,
          failed: result.failed,
          failureCount: result.failures.length,
          failuresPreview: failurePreview.values,
          failuresTruncated: failurePreview.truncated,
        }
      : {}),
  }
}
