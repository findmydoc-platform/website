import { APIError, type PayloadHandler } from 'payload'
import {
  activateHostedCapture,
  CapturePreparationRejected,
  hostedCaptureActivationSchema,
  readHostedCaptureStatus,
  requireCaptureOperator,
} from '@/features/clinicNotifications/hostedCapture'
import { recordNotificationDiagnostic } from '@/features/clinicNotifications/diagnostics'
import { getServerSideURL } from '@/utilities/getURL'

function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' },
  })
}

export const clinicNotificationCaptureGetHandler: PayloadHandler = async (req) => {
  const started = performance.now()
  try {
    const status = await readHostedCaptureStatus(req)
    if (req.url && new URL(req.url).search) throw new APIError('Invalid capture input.', 400)
    await recordNotificationDiagnostic(req, {
      operation: 'capture_prepare',
      result: 'success',
      elapsedMs: Math.round(performance.now() - started),
    })
    return response(status)
  } catch (error) {
    const status = error instanceof APIError && [400, 403, 409].includes(error.status) ? error.status : 503
    await recordNotificationDiagnostic(req, {
      operation: 'capture_prepare',
      result: status < 500 ? 'rejected' : 'failure',
      elapsedMs: Math.round(performance.now() - started),
    })
    return response(
      {
        error: {
          code:
            status === 403
              ? 'CAPTURE_ACCESS_DENIED'
              : status === 409
                ? 'CAPTURE_CONFLICT'
                : status === 400
                  ? 'CAPTURE_INVALID_INPUT'
                  : 'CAPTURE_UNAVAILABLE',
        },
      },
      status,
    )
  }
}

export const clinicNotificationCapturePostHandler: PayloadHandler = async (req) => {
  let submitted = false
  const started = performance.now()
  try {
    await requireCaptureOperator(req)
    const configured = new URL(req.payload.config.serverURL || getServerSideURL())
    if (
      configured.protocol !== 'https:' ||
      configured.username ||
      configured.password ||
      req.headers.get('origin') !== configured.origin ||
      !req.url ||
      new URL(req.url).origin !== configured.origin
    )
      throw new APIError('Request rejected.', 403)
    if (
      new URL(req.url).search ||
      req.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json' ||
      !req.body
    )
      throw new APIError('Invalid capture input.', 400)
    const reader = req.body.getReader()
    let value = ''
    let bytes = 0
    const chunks: Uint8Array[] = []
    try {
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > 2048) {
          await reader.cancel().catch(() => undefined)
          throw new APIError('Capture input too large.', 413)
        }
        chunks.push(chunk.value)
      }
      value = Buffer.concat(chunks).toString('utf8')
    } finally {
      reader.releaseLock()
    }
    let body: unknown
    try {
      body = JSON.parse(value)
    } catch {
      throw new APIError('Invalid capture input.', 400)
    }
    const parsed = hostedCaptureActivationSchema.safeParse(body)
    if (!parsed.success) throw new APIError('Invalid capture input.', 400)
    submitted = true
    const result = await activateHostedCapture(req, parsed.data)
    await recordNotificationDiagnostic(req, {
      operation: 'capture_activate',
      result: 'success',
      transactionOutcome: result.outcome === 'activated' ? 'committed' : 'not_committed',
      elapsedMs: Math.round(performance.now() - started),
    })
    return response(result)
  } catch (error) {
    const status = error instanceof APIError && [400, 403, 409, 413].includes(error.status) ? error.status : 503
    const writeOutcome = submitted && !(error instanceof CapturePreparationRejected) ? 'unknown' : 'not_committed'
    await recordNotificationDiagnostic(req, {
      operation: 'capture_activate',
      result: status < 500 ? 'rejected' : 'failure',
      transactionOutcome: writeOutcome,
      elapsedMs: Math.round(performance.now() - started),
    })
    return response(
      {
        error: {
          code:
            status === 403
              ? 'CAPTURE_ACCESS_DENIED'
              : status === 409
                ? 'CAPTURE_CONFLICT'
                : status < 500
                  ? 'CAPTURE_INVALID_INPUT'
                  : 'CAPTURE_UNAVAILABLE',
        },
        writeOutcome,
      },
      status,
    )
  }
}
