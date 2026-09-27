import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { validateTransactionalEmailStartup } from './environment'
import { loadHostedLettermintWebhookBinding } from './hostedConfiguration'
import { lettermintMessageEnvelope, type VerifiedLettermintEvent } from './lettermintEvent'
import { WebhookDeadline } from './webhookDeadline'

const maxBodyBytes = 256 * 1024
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)
const testEnvelope = z.object({
  id: identifier,
  event: z.literal('webhook.test'),
  timestamp: z.iso.datetime({ offset: true }),
  context: z.object({
    scope: z.literal('route'),
    team_id: identifier,
    project_id: identifier,
    route_id: identifier,
  }),
  data: z.object({
    webhook_id: identifier,
    metadata: z.object({ environment: z.enum(['preview', 'production']).optional() }).optional(),
  }),
})

function result(status: number, outcomeCode: string) {
  return Response.json({ outcomeCode }, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function readRawBody(request: Request, deadline: WebhookDeadline): Promise<Buffer | Response> {
  const reader = request.body?.getReader()
  if (!reader) return result(400, 'webhook-invalid')
  try {
    return await deadline.wait(
      (async () => {
        const chunks: Uint8Array[] = []
        let size = 0
        while (true) {
          const { done, value } = await reader.read()
          if (done) return Buffer.concat(chunks, size)
          size += value.byteLength
          if (size > maxBodyBytes) return result(413, 'webhook-too-large')
          chunks.push(value)
        }
      })(),
    )
  } finally {
    // A client-controlled stream must not delay rejection by hanging in cancel().
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

async function verifyLettermintWebhook(
  request: Request,
  routeEnvironment: string,
  deadline: WebhookDeadline,
): Promise<Response | VerifiedLettermintEvent> {
  try {
    if (new URL(request.url).protocol !== 'https:') return result(400, 'webhook-invalid')
    if (
      !/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i.test(request.headers.get('content-type') ?? '')
    ) {
      return result(415, 'webhook-unsupported-media')
    }
    if (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity') {
      return result(415, 'webhook-unsupported-media')
    }
    const length = request.headers.get('content-length')
    if (length !== null) {
      if (!/^[0-9]+$/.test(length)) return result(400, 'webhook-invalid')
      if (Number(length) > maxBodyBytes) return result(413, 'webhook-too-large')
    }
    const { environment } = validateTransactionalEmailStartup()
    if (environment !== 'preview' && environment !== 'production') return result(503, 'webhook-unavailable')
    if (routeEnvironment !== environment) return result(403, 'webhook-target-mismatch')
    const binding = loadHostedLettermintWebhookBinding(environment)
    const signature = /^t=([0-9]{1,12}),v1=([a-fA-F0-9]{64})$/.exec(request.headers.get('x-lettermint-signature') ?? '')
    if (!signature || Math.abs(Date.now() / 1000 - Number(signature[1])) > 300) {
      return result(401, 'webhook-unauthorized')
    }
    const body = await readRawBody(request, deadline)
    if (body instanceof Response) return body
    const now = Date.now()
    if (Math.abs(now / 1000 - Number(signature[1])) > 300) return result(401, 'webhook-unauthorized')
    const secrets = [binding.webhookSecret]
    const window = binding.previousWebhookSecretWindow
    if (binding.previousWebhookSecret && window && now >= window.startsAt && now <= window.validUntil) {
      secrets.push(binding.previousWebhookSecret)
    }
    const supplied = Buffer.from(signature[2]!, 'hex')
    let authenticated = false
    for (const secret of secrets) {
      const expected = createHmac('sha256', secret).update(`${signature[1]}.`).update(body).digest()
      authenticated = timingSafeEqual(expected, supplied) || authenticated
    }
    if (!authenticated) return result(401, 'webhook-unauthorized')
    let parsed: unknown
    try {
      parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body))
    } catch {
      return result(400, 'webhook-invalid')
    }
    const envelope = z.union([testEnvelope, lettermintMessageEnvelope]).safeParse(parsed)
    if (!envelope.success) return result(422, 'webhook-invalid')
    const event = envelope.data
    if (
      request.headers.get('x-lettermint-event') !== event.event ||
      event.context.team_id !== binding.target.teamId ||
      event.context.project_id !== binding.target.projectId ||
      event.context.route_id !== binding.target.routeId
    )
      return result(403, 'webhook-target-mismatch')
    if ('webhook_id' in event.data) {
      if (
        event.data.webhook_id !== binding.target.webhookId ||
        (event.data.metadata?.environment !== undefined && event.data.metadata.environment !== environment)
      )
        return result(403, 'webhook-target-mismatch')
      return result(200, 'webhook-test-verified')
    }
    const message = lettermintMessageEnvelope.safeParse(event)
    if (!message.success) return result(422, 'webhook-invalid')
    const { team_id, project_id, route_id } = message.data.context
    return { envelope: { ...message.data, context: { team_id, project_id, route_id } }, environment }
  } catch {
    // Never forward stream, parsing, or configuration exceptions to request telemetry.
    return result(503, 'webhook-unavailable')
  }
}

export async function receiveLettermintWebhook(
  request: Request,
  params: Promise<{ environment: string }>,
): Promise<Response> {
  const deadline = new WebhookDeadline()
  try {
    return await deadline.wait(processWebhook(request, params, deadline))
  } catch {
    return result(503, 'webhook-unavailable')
  } finally {
    deadline.dispose()
  }
}

async function processWebhook(
  request: Request,
  params: Promise<{ environment: string }>,
  deadline: WebhookDeadline,
): Promise<Response> {
  const { environment: routeEnvironment } = await params
  deadline.check()
  // Verification returns only projected fields. Its raw bytes and parsed body never reach storage or logging.
  const verified = await verifyLettermintWebhook(request, routeEnvironment, deadline)
  if (verified instanceof Response) return verified
  try {
    const [{ getPayload, createLocalReq }, { default: config }, { applyLettermintEvent }] = await Promise.all([
      import('payload'),
      import('@payload-config'),
      import('./providerEvents'),
    ])
    const payload = await getPayload({ config })
    const outcomeCode = await applyLettermintEvent(await createLocalReq({}, payload), verified, deadline)
    deadline.check()
    if (
      outcomeCode === 'provider-event-unmatched' ||
      outcomeCode === 'provider-event-mismatch' ||
      outcomeCode === 'provider-event-ignored'
    )
      payload.logger.warn({ outcomeCode })
    return result(200, outcomeCode)
  } catch {
    return result(503, 'webhook-unavailable')
  }
}
