import type { DeliveryAdapter, DeliveryOutcome } from './delivery'
import { TransactionalEmailError } from './errors'
import { selectTransactionalEmailRuntime, validateTransactionalEmailStartup } from './environment'
import { requireVerifiedHostedBinding, type HostedLettermintBinding } from './hostedConfiguration'

export const lettermintTimeoutMilliseconds = 20_000

export type LettermintHttpTransport = (
  url: string,
  init: RequestInit & { body: string; signal: AbortSignal },
) => Promise<Response>

export function createLettermintDeliveryAdapter(
  binding: HostedLettermintBinding,
  testTransport?: LettermintHttpTransport,
): DeliveryAdapter {
  requireVerifiedHostedBinding(binding)
  if (testTransport) {
    if (process.env.VITEST !== 'true' || selectTransactionalEmailRuntime().environment !== 'test')
      throw new TransactionalEmailError('environment-unavailable')
  } else if (validateTransactionalEmailStartup().environment !== binding.target.environment) {
    throw new TransactionalEmailError('environment-unavailable')
  }
  const transport: LettermintHttpTransport = testTransport ?? ((url, init) => fetch(url, init))
  return {
    async deliver(attempt, signal) {
      const request = attempt.providerRequest
      if (
        !request ||
        request.teamId !== binding.target.teamId ||
        request.projectId !== binding.target.projectId ||
        request.routeId !== binding.target.routeId
      )
        throw new TransactionalEmailError('environment-unavailable')
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      const abort = () => controller.abort()
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) controller.abort()
      try {
        if (controller.signal.aborted) return ambiguous()
        const timeout = new Promise<DeliveryOutcome>((resolve) => {
          controller.signal.addEventListener('abort', () => resolve(ambiguous()), { once: true })
          timer = setTimeout(abort, lettermintTimeoutMilliseconds)
        })
        const send = async () => {
          const response = await transport('https://api.lettermint.co/v1/send', {
            method: 'POST',
            body: request.body,
            headers: {
              'x-lettermint-token': binding.projectToken,
              'Idempotency-Key': attempt.providerIdempotencyKey,
              'Content-Type': 'application/json',
            },
            redirect: 'error',
            cache: 'no-store',
            credentials: 'omit',
            signal: controller.signal,
          })
          return normalizeResponse(response, controller.signal)
        }
        return await Promise.race([timeout, send()])
      } catch {
        return ambiguous()
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
        controller.abort()
      }
    },
  }
}

async function normalizeResponse(response: Response, signal: AbortSignal): Promise<DeliveryOutcome> {
  const status = response.status
  if ([408, 425, 429].includes(status) || (status >= 500 && status <= 599)) {
    void response.body?.cancel().catch(() => undefined)
    return { type: 'retryable', outcomeCode: status === 429 ? 'provider-rate-limited' : 'provider-temporary' }
  }
  if (status >= 400 && status <= 499 && status !== 409) {
    void response.body?.cancel().catch(() => undefined)
    return {
      type: 'permanent',
      outcomeCode: 'provider-request-rejected',
      alert: status === 401 || status === 403 ? 'configuration' : 'rejection',
    }
  }
  let body: Record<string, unknown> = {}
  try {
    const parsed: unknown = await readResponse(response, signal)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>
  } catch {
    // A provider message is never an internal outcome code.
  }
  if (status === 409) {
    if (body.code === 'invalid_idempotent_request')
      return { type: 'permanent', outcomeCode: 'provider-idempotency-conflict', alert: 'invariant' }
    if (body.code === 'concurrent_idempotent_requests')
      return { type: 'ambiguous', outcomeCode: 'provider-request-in-progress' }
    return { type: 'ambiguous', outcomeCode: 'provider-conflict-unknown' }
  }
  if (status === 202) {
    if (
      typeof body.status === 'string' &&
      ['suppressed', 'policy_rejected', 'blocked', 'failed', 'canceled', 'unsubscribed'].includes(body.status)
    )
      return { type: 'permanent', outcomeCode: 'provider-policy-rejected', alert: 'rejection' }
    if (
      typeof body.status === 'string' &&
      [
        'pending',
        'queued',
        'processed',
        'delivered',
        'opened',
        'clicked',
        'soft_bounced',
        'hard_bounced',
        'spam_complaint',
      ].includes(body.status) &&
      typeof body.message_id === 'string' &&
      /^[A-Za-z0-9_-]{1,128}$/.test(body.message_id)
    )
      return { type: 'accepted', messageId: body.message_id, outcomeCode: 'provider-accepted' }
  }
  return ambiguous()
}

function ambiguous(): DeliveryOutcome {
  return { type: 'ambiguous', outcomeCode: 'provider-ambiguous' }
}

async function readResponse(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body || signal.aborted) throw new Error('Unavailable response')
  const reader = response.body.getReader()
  const cancel = () => {
    void reader.cancel().catch(() => undefined)
  }
  signal.addEventListener('abort', cancel, { once: true })
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0
  let text = ''
  try {
    while (!signal.aborted) {
      const chunk = await reader.read()
      if (chunk.done) return JSON.parse(text + decoder.decode())
      bytes += chunk.value.byteLength
      if (bytes > 65_536) throw new Error('Oversized response')
      text += decoder.decode(chunk.value, { stream: true })
    }
    throw new Error('Unavailable response')
  } finally {
    signal.removeEventListener('abort', cancel)
    cancel()
  }
}
