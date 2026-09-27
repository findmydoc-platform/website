import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { resolveTransactionalEmailEnvironment, validateTransactionalEmailStartup } from './environment'
import { loadHostedLettermintWebhookBinding } from './hostedConfiguration'
import {
  issueVerifiedLettermintEvent,
  lettermintMessageEnvelope,
  type VerifiedLettermintEvent,
} from './lettermintEvent'
import { WebhookDeadline } from './webhookDeadline'
import { safeProviderEventType, type DeliveryEdgeLog, type DeliveryEdgeOutcomeCode } from './operationalSignals'

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

type HostedWebhookEnvironment = 'preview' | 'production'
type WebhookSignalDetails = Omit<DeliveryEdgeLog, 'environment' | 'outcomeCode'>
type WebhookResult = {
  response: Response
  outcomeCode: DeliveryEdgeOutcomeCode
  environment?: HostedWebhookEnvironment
  signalDetails?: WebhookSignalDetails
}
type VerifiedWebhook = { event: VerifiedLettermintEvent; environment: HostedWebhookEnvironment }

function result(status: number, outcomeCode: DeliveryEdgeOutcomeCode) {
  return Response.json({ outcomeCode }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function webhookResult(
  status: number,
  outcomeCode: DeliveryEdgeOutcomeCode,
  environment?: HostedWebhookEnvironment,
  signalDetails?: WebhookSignalDetails,
): WebhookResult {
  return {
    response: result(status, outcomeCode),
    outcomeCode,
    ...(environment ? { environment } : {}),
    ...(signalDetails ? { signalDetails } : {}),
  }
}

async function readRawBody(request: Request, deadline: WebhookDeadline): Promise<Buffer | WebhookResult> {
  const reader = request.body?.getReader()
  if (!reader) return webhookResult(400, 'webhook-invalid')
  try {
    return await deadline.wait(
      (async () => {
        const chunks: Uint8Array[] = []
        let size = 0
        while (true) {
          const { done, value } = await reader.read()
          if (done) return Buffer.concat(chunks, size)
          size += value.byteLength
          if (size > maxBodyBytes) return webhookResult(413, 'webhook-too-large')
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
  environment: HostedWebhookEnvironment,
  deadline: WebhookDeadline,
): Promise<WebhookResult | VerifiedWebhook> {
  try {
    if (new URL(request.url).protocol !== 'https:') return webhookResult(400, 'webhook-invalid', environment)
    if (
      !/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i.test(request.headers.get('content-type') ?? '')
    ) {
      return webhookResult(415, 'webhook-unsupported-media', environment)
    }
    if (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity') {
      return webhookResult(415, 'webhook-unsupported-media', environment)
    }
    const length = request.headers.get('content-length')
    if (length !== null) {
      if (!/^[0-9]+$/.test(length)) return webhookResult(400, 'webhook-invalid', environment)
      if (Number(length) > maxBodyBytes) return webhookResult(413, 'webhook-too-large', environment)
    }
    if (routeEnvironment !== environment) return webhookResult(403, 'webhook-target-mismatch', environment)
    const binding = loadHostedLettermintWebhookBinding(environment)
    const signature = /^t=([0-9]{1,12}),v1=([a-fA-F0-9]{64})$/.exec(request.headers.get('x-lettermint-signature') ?? '')
    if (!signature || Math.abs(Date.now() / 1000 - Number(signature[1])) > 300) {
      return webhookResult(401, 'webhook-unauthorized', environment)
    }
    const body = await readRawBody(request, deadline)
    if (!Buffer.isBuffer(body)) return { ...body, environment }
    const now = Date.now()
    if (Math.abs(now / 1000 - Number(signature[1])) > 300)
      return webhookResult(401, 'webhook-unauthorized', environment)
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
    if (!authenticated) return webhookResult(401, 'webhook-unauthorized', environment)
    let parsed: unknown
    try {
      parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body))
    } catch {
      return webhookResult(400, 'webhook-invalid', environment)
    }
    const envelope = z.union([testEnvelope, lettermintMessageEnvelope]).safeParse(parsed)
    if (!envelope.success) return webhookResult(422, 'webhook-invalid', environment)
    const event = envelope.data
    if (
      request.headers.get('x-lettermint-event') !== event.event ||
      event.context.team_id !== binding.target.teamId ||
      event.context.project_id !== binding.target.projectId ||
      event.context.route_id !== binding.target.routeId
    )
      return webhookResult(403, 'webhook-target-mismatch', environment)
    if ('webhook_id' in event.data) {
      if (
        event.data.webhook_id !== binding.target.webhookId ||
        (event.data.metadata?.environment !== undefined && event.data.metadata.environment !== environment)
      )
        return webhookResult(403, 'webhook-target-mismatch', environment)
      return webhookResult(200, 'webhook-test-verified', environment)
    }
    const message = lettermintMessageEnvelope.safeParse(event)
    if (!message.success) return webhookResult(422, 'webhook-invalid', environment)
    const { team_id, project_id, route_id } = message.data.context
    const { recipient, ...data } = message.data.data
    let recipientDigest: string | undefined
    let recipientDigestCandidates: readonly string[] | undefined
    if (['message.hard_bounced', 'message.spam_complaint'].includes(message.data.event)) {
      if (typeof recipient !== 'string') return webhookResult(422, 'webhook-invalid', environment)
      recipientDigestCandidates = binding.recipientDigests(recipient) ?? undefined
      recipientDigest = recipientDigestCandidates?.[0]
      if (!recipientDigest || !recipientDigestCandidates) return webhookResult(422, 'webhook-invalid', environment)
    }
    return {
      environment,
      event: issueVerifiedLettermintEvent({
        envelope: { ...message.data, data, context: { team_id, project_id, route_id } },
        environment,
        recipientDigest,
        recipientDigestCandidates,
      }),
    }
  } catch {
    // Never forward stream, parsing, or configuration exceptions to request telemetry.
    return webhookResult(503, 'webhook-unavailable', environment)
  }
}

export async function receiveLettermintWebhook(
  request: Request,
  params: Promise<{ environment: string }>,
  options: { signal?: (event: DeliveryEdgeLog) => void } = {},
): Promise<Response> {
  const deadline = new WebhookDeadline()
  let completed: WebhookResult
  try {
    const routeEnvironment = (await deadline.wait(params)).environment
    const environment = resolveTransactionalEmailEnvironment()
    if (environment !== 'preview' && environment !== 'production') completed = webhookResult(503, 'webhook-unavailable')
    else {
      let bindingIsValid = true
      try {
        validateTransactionalEmailStartup()
      } catch {
        bindingIsValid = false
      }
      completed = bindingIsValid
        ? await deadline.wait(processWebhook(request, routeEnvironment, environment, deadline))
        : webhookResult(503, 'configuration-drift', environment)
    }
  } catch {
    completed = webhookResult(503, 'webhook-unavailable')
  } finally {
    deadline.dispose()
  }
  if (options.signal && completed.environment) {
    try {
      options.signal({
        environment: completed.environment,
        outcomeCode: completed.outcomeCode,
        ...completed.signalDetails,
      })
    } catch {
      // Operational telemetry must not alter an already-decided webhook response.
    }
  }
  return completed.response
}

async function processWebhook(
  request: Request,
  routeEnvironment: string,
  environment: HostedWebhookEnvironment,
  deadline: WebhookDeadline,
): Promise<WebhookResult> {
  deadline.check()
  // Verification returns only projected fields. Its raw bytes and parsed body never reach storage or logging.
  const verified = await verifyLettermintWebhook(request, routeEnvironment, environment, deadline)
  if ('response' in verified) return verified
  try {
    const [{ getPayload, createLocalReq }, { default: config }, { applyLettermintEvent }] = await Promise.all([
      import('payload'),
      import('@payload-config'),
      import('./providerEvents'),
    ])
    const payload = await getPayload({ config })
    const outcomeCode = await applyLettermintEvent(await createLocalReq({}, payload), verified.event, deadline)
    deadline.check()
    return webhookResult(200, outcomeCode, verified.environment, {
      ...(verified.event.envelope.data.metadata?.operation_id &&
      /^[1-9][0-9]{0,9}$/.test(verified.event.envelope.data.metadata.operation_id)
        ? { operationId: verified.event.envelope.data.metadata.operation_id }
        : {}),
      providerEventId: verified.event.envelope.id,
      providerEventType: safeProviderEventType(verified.event.envelope.event),
      ...(verified.event.envelope.data.message_id
        ? { providerMessageId: verified.event.envelope.data.message_id }
        : {}),
    })
  } catch {
    return webhookResult(503, 'webhook-unavailable', verified.environment)
  }
}
