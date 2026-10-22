import type { PayloadRequest } from 'payload'
import { sendPostHogException } from '@/posthog/api'
import { fallbackConsoleLogger } from '@/utilities/logging/consoleLogger'
import type { ServerLogger } from '@/utilities/logging/shared'
import { z } from 'zod'
const signalSchema = z.strictObject({
  result: z.enum(['success', 'busy', 'incomplete', 'failure']),
  transactionOutcome: z.enum(['committed', 'not_committed', 'unknown']),
  elapsedMs: z.number().int().nonnegative(),
  attemptCount: z.number().int().nonnegative(),
  occurrencesDeleted: z.number().int().nonnegative(),
  receiptsDeleted: z.number().int().nonnegative(),
  missedSlots: z.number().int().nonnegative(),
  recoveredInterruptedRun: z.boolean(),
})
export type RetentionSignal = z.infer<typeof signalSchema>
export async function recordRetentionDiagnostic(req: PayloadRequest, value: RetentionSignal): Promise<void> {
  return emitRetentionDiagnostic(req.payload.logger, value)
}

export async function recordRetentionCompositionFailure(elapsedMs: number): Promise<void> {
  return emitRetentionDiagnostic(fallbackConsoleLogger, {
    result: 'failure',
    transactionOutcome: 'not_committed',
    elapsedMs: Math.max(0, Math.floor(elapsedMs)),
    attemptCount: 0,
    occurrencesDeleted: 0,
    receiptsDeleted: 0,
    missedSlots: 0,
    recoveredInterruptedRun: false,
  })
}

async function emitRetentionDiagnostic(
  logger: Pick<ServerLogger, 'error' | 'info'>,
  value: RetentionSignal,
): Promise<void> {
  const parsed = signalSchema.safeParse(value)
  if (!parsed.success) return
  const fields = {
    event: 'clinic_dashboard.notifications.retention',
    application: 'website',
    environment: ['production', 'preview', 'test'].includes(process.env.DEPLOYMENT_ENVIRONMENT ?? '')
      ? process.env.DEPLOYMENT_ENVIRONMENT
      : 'local',
    ...parsed.data,
  }
  const failed =
    fields.result === 'failure' ||
    fields.result === 'incomplete' ||
    fields.missedSlots > 0 ||
    fields.recoveredInterruptedRun
  try {
    if (failed) logger.error(fields, 'Clinic notification retention needs recovery')
    else logger.info(fields, 'Clinic notification retention execution')
  } catch {
    /* Telemetry cannot change committed deletion. */
  }
  if (failed) {
    try {
      await sendPostHogException(new Error('Clinic notification retention needs recovery'), {
        properties: {
          notification_retention_result: fields.result,
          notification_retention_transaction_outcome: fields.transactionOutcome,
          notification_retention_elapsed_ms: fields.elapsedMs,
          notification_retention_attempt_count: fields.attemptCount,
          notification_retention_occurrences_deleted: fields.occurrencesDeleted,
          notification_retention_receipts_deleted: fields.receiptsDeleted,
          notification_retention_missed_slots: fields.missedSlots,
          notification_retention_interrupted_run: fields.recoveredInterruptedRun,
        },
      })
    } catch {
      /* A bounded diagnostic sink cannot alter the command outcome. */
    }
  }
}
