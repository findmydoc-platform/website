import { revalidatePath, revalidateTag } from 'next/cache'

import { normalizeRevalidationPlanIdentifiers } from './identifiers'
import { buildRevalidationLogPayload, REVALIDATION_LOG_EVENTS } from './logPayload'
import type { RevalidationExecutionResult, RevalidationFailure, RevalidationLogger, RevalidationPlan } from './types'

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

  logger?.info?.(
    buildRevalidationLogPayload({
      eventName: REVALIDATION_LOG_EVENTS.planned,
      plan: normalizedPlan,
    }),
    'Cache revalidation planned',
  )

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

  logger?.info?.(
    buildRevalidationLogPayload({
      eventName: REVALIDATION_LOG_EVENTS.executed,
      plan: normalizedPlan,
      result,
    }),
    'Cache revalidation executed',
  )

  if (failures.length > 0) {
    logger?.warn?.(
      buildRevalidationLogPayload({
        eventName: REVALIDATION_LOG_EVENTS.failed,
        plan: normalizedPlan,
        result,
      }),
      'Cache revalidation failures occurred',
    )
  }

  return result
}
