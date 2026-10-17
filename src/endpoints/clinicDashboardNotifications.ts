import { getClinicDashboardOrigin } from '@/auth/utilities/clinicDashboardOrigin'
import type { PayloadHandler } from 'payload'
import { resolveClinicDashboardPrincipal } from '@/features/clinicDashboard/bootstrap'
import { CLINIC_SCOPE_CONTRACT_HEADER, hasClinicScopeContract } from '@/features/clinicDashboard/contractNegotiation'
import { CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS } from './clinicDashboardBootstrap'
import {
  CLINIC_NOTIFICATIONS_CONTRACT_VERSION,
  CLINIC_NOTIFICATIONS_CONTRACT_HEADER,
  CLINIC_NOTIFICATIONS_SUPPORT_HEADER,
  notificationReadQuerySchema,
  notificationReadInputSchema,
  NOTIFICATION_READ_MAX_BYTES,
  type NotificationErrorCode,
} from '@/features/clinicNotifications/contracts'
import {
  ClinicNotificationError,
  markClinicNotificationsRead,
  readClinicNotifications,
} from '@/features/clinicNotifications/service'
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
      Vary: `${CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS.Vary}, ${CLINIC_NOTIFICATIONS_CONTRACT_HEADER}, ${CLINIC_SCOPE_CONTRACT_HEADER}`,
      [CLINIC_NOTIFICATIONS_SUPPORT_HEADER]: CLINIC_NOTIFICATIONS_CONTRACT_VERSION,
    },
  })
}

export const clinicDashboardNotificationsGetHandler: PayloadHandler = async (req) => {
  const started = performance.now()
  const query = new URL(req.url ?? 'http://localhost:3000').searchParams
  const mode = query.get('mode') === 'summary' ? 'summary_read' : 'feed_read'
  try {
    if (
      req.headers.get(CLINIC_NOTIFICATIONS_CONTRACT_HEADER) !== CLINIC_NOTIFICATIONS_CONTRACT_VERSION ||
      !hasClinicScopeContract(req.headers)
    ) {
      throw new ClinicNotificationError('CONTRACT_INCOMPATIBLE')
    }
    const authorization = await resolveClinicDashboardPrincipal(req)
    if (authorization.status !== 'success') {
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
    await recordNotificationDiagnostic(req, {
      operation: mode,
      result: 'success',
      elapsedMs: Math.round(performance.now() - started),
    })
    return response(result, 200)
  } catch (error) {
    const code = error instanceof ClinicNotificationError ? error.code : 'SERVICE_UNAVAILABLE'
    await recordNotificationDiagnostic(req, {
      operation: mode,
      result: statuses[code] < 500 ? 'rejected' : 'failure',
      errorCode: code,
      elapsedMs: Math.round(performance.now() - started),
    })
    return response({ contractVersion: CLINIC_NOTIFICATIONS_CONTRACT_VERSION, error: { code } }, statuses[code])
  }
}

export const clinicDashboardNotificationsReadPostHandler: PayloadHandler = async (req) => {
  const started = performance.now()
  let commandStarted = false
  try {
    if (
      req.headers.get(CLINIC_NOTIFICATIONS_CONTRACT_HEADER) !== CLINIC_NOTIFICATIONS_CONTRACT_VERSION ||
      !hasClinicScopeContract(req.headers)
    )
      throw new ClinicNotificationError('CONTRACT_INCOMPATIBLE')
    if (req.headers.get('origin') !== getClinicDashboardOrigin()) throw new ClinicNotificationError('REQUEST_REJECTED')
    if (new URL(req.url ?? 'http://localhost:3000').search) throw new ClinicNotificationError('INVALID_INPUT')
    if (req.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json')
      throw new ClinicNotificationError('INVALID_INPUT')
    const declared = req.headers.get('content-length')
    if (declared && Number(declared) > NOTIFICATION_READ_MAX_BYTES)
      throw new ClinicNotificationError('PAYLOAD_TOO_LARGE')
    if (!req.body) throw new ClinicNotificationError('INVALID_INPUT')
    const reader = req.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.byteLength
        if (size > NOTIFICATION_READ_MAX_BYTES) {
          await reader.cancel().catch(() => undefined)
          throw new ClinicNotificationError('PAYLOAD_TOO_LARGE')
        }
        chunks.push(chunk.value)
      }
    } finally {
      reader.releaseLock()
    }
    let value: unknown
    try {
      value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      throw new ClinicNotificationError('INVALID_INPUT')
    }
    const input = notificationReadInputSchema.safeParse(value)
    if (!input.success) throw new ClinicNotificationError('INVALID_INPUT')
    const authorization = await resolveClinicDashboardPrincipal(req)
    if (authorization.status !== 'success')
      throw new ClinicNotificationError(
        authorization.status === 'unauthorized'
          ? 'UNAUTHENTICATED'
          : authorization.status === 'access-denied'
            ? 'CLINIC_ACCESS_DENIED'
            : 'SERVICE_UNAVAILABLE',
      )
    commandStarted = true
    return response(await markClinicNotificationsRead(req, input.data), 200)
  } catch (error) {
    const code = error instanceof ClinicNotificationError ? error.code : 'SERVICE_UNAVAILABLE'
    const writeOutcome =
      error instanceof ClinicNotificationError && error.writeOutcome
        ? error.writeOutcome
        : commandStarted
          ? 'unknown'
          : 'not_committed'
    if (!commandStarted || !(error instanceof ClinicNotificationError))
      await recordNotificationDiagnostic(req, {
        operation: 'acknowledge',
        result: statuses[code] < 500 ? 'rejected' : 'failure',
        errorCode: code,
        transactionOutcome: writeOutcome,
        elapsedMs: Math.round(performance.now() - started),
      })
    return response(
      { contractVersion: CLINIC_NOTIFICATIONS_CONTRACT_VERSION, error: { code }, writeOutcome },
      statuses[code],
    )
  }
}
