import { revalidatePath, revalidateTag } from 'next/cache'

import { normalizeRevalidationPlanIdentifiers } from './identifiers'
import { buildRevalidationLogPayload, REVALIDATION_LOG_EVENTS } from './logPayload'
import type { RevalidationExecutionResult, RevalidationFailure, RevalidationLogger, RevalidationPlan } from './types'
import { recordCacheRevalidationVisibilityFromLogPayload } from './visibility'

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export const executeRevalidationPlan = (
  plan: RevalidationPlan,
  { logger }: { logger?: RevalidationLogger } = {},
): RevalidationExecutionResult => {
  const normalizedPlan = normalizeRevalidationPlanIdentifiers(plan)
  const tags = normalizedPlan.tags
  const paths = normalizedPlan.paths
  const failures: RevalidationFailure[] = []
  let succeededTagCount = 0
  let succeededPathCount = 0

  const plannedLogPayload = buildRevalidationLogPayload({
    eventName: REVALIDATION_LOG_EVENTS.planned,
    plan: normalizedPlan,
  })
  recordCacheRevalidationVisibilityFromLogPayload(plannedLogPayload)
  logger?.info?.(plannedLogPayload, 'Cache revalidation planned')

  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 })
      succeededTagCount += 1
    } catch (error) {
      failures.push({ kind: 'tag', identifier: tag, message: errorMessage(error) })
    }
  }

  for (const path of paths) {
    try {
      revalidatePath(path)
      succeededPathCount += 1
    } catch (error) {
      failures.push({ kind: 'path', identifier: path, message: errorMessage(error) })
    }
  }

  const result = {
    operation: normalizedPlan.operation,
    source: normalizedPlan.source,
    subject: normalizedPlan.subject,
    attempted: {
      tagCount: tags.length,
      pathCount: paths.length,
    },
    succeeded: {
      tagCount: succeededTagCount,
      pathCount: succeededPathCount,
    },
    failed: {
      tagCount: tags.length - succeededTagCount,
      pathCount: paths.length - succeededPathCount,
    },
    failures,
  } satisfies RevalidationExecutionResult

  const executedLogPayload = buildRevalidationLogPayload({
    eventName: REVALIDATION_LOG_EVENTS.executed,
    plan: normalizedPlan,
    result,
  })
  recordCacheRevalidationVisibilityFromLogPayload(executedLogPayload)
  logger?.info?.(executedLogPayload, 'Cache revalidation executed')

  if (failures.length > 0) {
    const failedLogPayload = buildRevalidationLogPayload({
      eventName: REVALIDATION_LOG_EVENTS.failed,
      plan: normalizedPlan,
      result,
    })
    recordCacheRevalidationVisibilityFromLogPayload(failedLogPayload)
    logger?.warn?.(failedLogPayload, 'Cache revalidation failures occurred')
  }

  return result
}
