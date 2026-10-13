import type { PayloadHandler } from 'payload'
import { revalidateClinicDashboardRequest } from '@/features/clinicDashboard/authorization'
import { CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS } from './clinicDashboardBootstrap'
import {
  CLINIC_NOTIFICATIONS_CONTRACT_VERSION,
  CLINIC_NOTIFICATIONS_CONTRACT_HEADER,
  CLINIC_NOTIFICATIONS_SUPPORT_HEADER,
  notificationReadQuerySchema,
  type NotificationErrorCode,
} from '@/features/clinicNotifications/contracts'
import { ClinicNotificationError, readClinicNotifications } from '@/features/clinicNotifications/service'
import { recordNotificationDiagnostic } from '@/features/clinicNotifications/diagnostics'

const statuses: Record<NotificationErrorCode, number> = {
  UNAUTHENTICATED: 401,
  CLINIC_ACCESS_DENIED: 403,
  CONTENT_ACCESS_DENIED: 403,
  INVALID_INPUT: 400,
  REQUEST_REJECTED: 403,
  TARGET_UNAVAILABLE: 404,
  CURSOR_INVALID: 400,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  SERVICE_TIMEOUT: 504,
  CONTRACT_INCOMPATIBLE: 409,
  PAYLOAD_TOO_LARGE: 413,
}

function response(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      ...CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS,
      Vary: `${CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS.Vary}, ${CLINIC_NOTIFICATIONS_CONTRACT_HEADER}`,
      [CLINIC_NOTIFICATIONS_SUPPORT_HEADER]: CLINIC_NOTIFICATIONS_CONTRACT_VERSION,
    },
  })
}

export const clinicDashboardNotificationsGetHandler: PayloadHandler = async (req) => {
  const started = performance.now()
  const query = new URL(req.url ?? 'http://localhost:3000').searchParams
  const mode = query.get('mode') === 'summary' ? 'summary_read' : 'feed_read'
  try {
    if (req.headers.get(CLINIC_NOTIFICATIONS_CONTRACT_HEADER) !== CLINIC_NOTIFICATIONS_CONTRACT_VERSION) {
      throw new ClinicNotificationError('CONTRACT_INCOMPATIBLE')
    }
    const authorization = await revalidateClinicDashboardRequest(req, 'inquiry')
    if (authorization.status !== 'authorized') {
      throw new ClinicNotificationError(
        authorization.status === 'unauthorized'
          ? 'UNAUTHENTICATED'
          : authorization.status === 'access-denied'
            ? 'CLINIC_ACCESS_DENIED'
            : 'SERVICE_UNAVAILABLE',
      )
    }
    if ([...query.keys()].some((key) => query.getAll(key).length !== 1))
      throw new ClinicNotificationError('INVALID_INPUT')
    const input = notificationReadQuerySchema.safeParse(Object.fromEntries(query))
    if (!input.success) throw new ClinicNotificationError('INVALID_INPUT')
    const result = await readClinicNotifications(req, input.data)
    recordNotificationDiagnostic(req, {
      operation: mode,
      result: 'success',
      elapsedMs: Math.round(performance.now() - started),
    })
    return response(result, 200)
  } catch (error) {
    const code = error instanceof ClinicNotificationError ? error.code : 'SERVICE_UNAVAILABLE'
    recordNotificationDiagnostic(req, {
      operation: mode,
      result: statuses[code] < 500 ? 'rejected' : 'failure',
      errorCode: code,
      elapsedMs: Math.round(performance.now() - started),
    })
    return response({ contractVersion: CLINIC_NOTIFICATIONS_CONTRACT_VERSION, error: { code } }, statuses[code])
  }
}
