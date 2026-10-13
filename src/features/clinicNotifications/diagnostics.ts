import type { PayloadRequest } from 'payload'
import { CLINIC_NOTIFICATIONS_CONTRACT_VERSION, type NotificationErrorCode } from './contracts'

export function recordNotificationDiagnostic(
  req: PayloadRequest,
  details: {
    operation: 'feed_read' | 'summary_read' | 'source_capture'
    result: 'success' | 'rejected' | 'failure'
    errorCode?: NotificationErrorCode
    elapsedMs: number
    attemptCount?: number
    transactionOutcome?: 'committed' | 'not_committed' | 'unknown'
  },
): void {
  try {
    req.payload.logger.info(
      {
        event: 'clinic_dashboard.notifications',
        application: 'website',
        environment: ['production', 'preview', 'test'].includes(process.env.DEPLOYMENT_ENV ?? '')
          ? process.env.DEPLOYMENT_ENV
          : 'local',
        contractVersion: CLINIC_NOTIFICATIONS_CONTRACT_VERSION,
        ...details,
      },
      'Clinic notification operation',
    )
  } catch {
    // A diagnostic sink cannot change the outcome of business work.
  }
}
