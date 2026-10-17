import type { PayloadRequest } from 'payload'
import { z } from 'zod'
import { sendPostHogException } from '@/posthog/api'
import { CLINIC_NOTIFICATIONS_CONTRACT_VERSION, notificationErrorCodes } from './contracts'

const diagnosticSchema = z.strictObject({
  operation: z.enum([
    'feed_read',
    'summary_read',
    'source_capture',
    'acknowledge',
    'capture_prepare',
    'capture_activate',
  ]),
  result: z.enum(['success', 'rejected', 'failure']),
  errorCode: z.enum(notificationErrorCodes).optional(),
  elapsedMs: z.number().int().nonnegative(),
  attemptCount: z.number().int().nonnegative().optional(),
  transactionOutcome: z.enum(['committed', 'not_committed', 'unknown']).optional(),
})

export async function recordNotificationDiagnostic(
  req: PayloadRequest,
  details: z.infer<typeof diagnosticSchema>,
): Promise<void> {
  const parsed = diagnosticSchema.safeParse(details)
  if (!parsed.success) return
  const safe = parsed.data
  const fields = {
    event: 'clinic_dashboard.notifications',
    application: 'website',
    environment: ['production', 'preview', 'test'].includes(process.env.DEPLOYMENT_ENV ?? '')
      ? process.env.DEPLOYMENT_ENV
      : 'local',
    contractVersion: CLINIC_NOTIFICATIONS_CONTRACT_VERSION,
    ...safe,
  }
  try {
    if (safe.result === 'failure') req.payload.logger.error(fields, 'Clinic notification operation failed')
    else req.payload.logger.info(fields, 'Clinic notification operation')
  } catch {
    /* Diagnostics cannot change committed business work or rejection. */
  }
  if (safe.result !== 'failure') return
  try {
    await sendPostHogException(new Error('Clinic notification operation failed'), {
      properties: {
        notification_operation: safe.operation,
        notification_result: safe.result,
        notification_contract_version: CLINIC_NOTIFICATIONS_CONTRACT_VERSION,
        notification_elapsed_ms: safe.elapsedMs,
        ...(safe.errorCode ? { notification_error_code: safe.errorCode } : {}),
        ...(safe.attemptCount !== undefined ? { notification_attempt_count: safe.attemptCount } : {}),
        ...(safe.transactionOutcome ? { notification_transaction_outcome: safe.transactionOutcome } : {}),
      },
    })
  } catch {
    /* The existing bounded exception sender cannot change business results. */
  }
}
