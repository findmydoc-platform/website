import { createHash, randomUUID } from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'
import pg from 'pg'
import config from '@payload-config'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import { resolveActivationPolicy } from '@/features/transactionalEmail/activationPolicy'
import {
  createLettermintDeliveryAdapter,
  type LettermintHttpTransport,
} from '@/features/transactionalEmail/lettermintDelivery'
import { resolveHostedLettermintBinding } from '@/features/transactionalEmail/hostedConfiguration'
import { webhookNow } from '../fixtures/lettermintWebhook'
import { createActivationFixture } from '../fixtures/transactionalEmailActivation'
import { syntheticEmailCatalog, syntheticRegistrationId } from '../fixtures/transactionalEmail'
import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'

describe('Lettermint delivery through the real worker', () => {
  let payload: Payload
  let observer: pg.Client
  const references: string[] = []
  beforeAll(async () => {
    payload = await getPayload({ config })
    observer = new pg.Client({ connectionString: process.env.DATABASE_URI })
    await observer.connect()
  }, 60000)
  beforeEach(() => {
    vi.stubEnv('CI', 'false')
    const deny = () => {
      throw new Error('External network forbidden')
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(deny)
    vi.spyOn(http, 'request').mockImplementation(deny)
    vi.spyOn(https, 'request').mockImplementation(deny)
    vi.spyOn(payload.logger, 'error').mockImplementation(() => undefined)
    vi.spyOn(payload.logger, 'fatal').mockImplementation(() => undefined)
  })
  afterEach(() => {
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(http.request).not.toHaveBeenCalled()
    expect(https.request).not.toHaveBeenCalled()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })
  afterAll(async () => {
    try {
      await cleanupTransactionalEmailFixtures(payload, references)
    } finally {
      await observer?.end()
    }
  })
  async function accept() {
    const req = await createLocalReq({}, payload)
    const operationReference = randomUUID()
    references.push(operationReference)
    const { operationId } = await bindTransactionalEmail(req, syntheticEmailCatalog).accept({
      type: 'clinic.registration-received',
      operationReference,
      registrationId: syntheticRegistrationId,
    })
    return { req, operationId }
  }
  const stored = async (id: string) =>
    (await observer.query('SELECT * FROM transactional_email_outbox WHERE id = $1', [id])).rows[0]
  function providerOptions(fixture = createActivationFixture()) {
    const environment = fixture.binding.target.environment
    const binding = resolveHostedLettermintBinding(
      environment,
      fixture.configuration.registry,
      fixture.configuration.secrets[environment],
      webhookNow,
      fixture.configuration.locks,
    )
    return {
      catalog: syntheticEmailCatalog,
      suppression: async () => 'cleared' as const,
      providerBinding: binding,
      activationPolicy: resolveActivationPolicy(
        binding,
        fixture.registry,
        environment === 'preview'
          ? ['digest-preview:b6b9397238db67fdbabcf8b26ff25b27694d3c9e4ae7ce14ddc692cc7bea29cf']
          : undefined,
      ),
    }
  }

  it('sends durable bytes and bound headers once, then stores acceptance and scrubs content', async () => {
    const { req, operationId } = await accept()
    const options = providerOptions()
    let committed: Record<string, unknown> | undefined
    const httpTransport: LettermintHttpTransport = vi.fn(async (url, init) => {
      committed = await stored(operationId)
      expect(url).toBe('https://api.lettermint.co/v1/send')
      expect(init.body).toBe(committed!.prepared_provider_request)
      expect(init.headers).toEqual({
        'x-lettermint-token': options.providerBinding.projectToken,
        'Idempotency-Key': committed!.provider_idempotency_key,
        'Content-Type': 'application/json',
      })
      expect(init.method).toBe('POST')
      expect(init.redirect).toBe('error')
      return Response.json({ message_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', status: 'pending' }, { status: 202 })
    })
    await createTransactionalEmailWorker(req, { ...options, httpTransport }).run(operationId)
    expect(httpTransport).toHaveBeenCalledOnce()
    expect(committed).toMatchObject({ state: 'prepared', attempt_count: '1' })
    expect(await stored(operationId)).toMatchObject({
      state: 'accepted',
      provider_message_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      prepared_provider_request: null,
      recipient_address: null,
      prepared_subject: null,
      prepared_html: null,
      prepared_text: null,
      command_payload: null,
    })
    const events = await observer.query(
      'SELECT outcome_code FROM transactional_email_events WHERE outbox_id = $1 AND type = $2',
      [operationId, 'delivery.accepted'],
    )
    expect(events.rows).toEqual([{ outcome_code: 'provider-accepted' }])
  })
  it.each([
    [408, {}, 'prepared', 'provider-temporary'],
    [425, {}, 'prepared', 'provider-temporary'],
    [429, {}, 'prepared', 'provider-rate-limited'],
    [500, {}, 'prepared', 'provider-temporary'],
    [503, {}, 'prepared', 'provider-temporary'],
    [409, { code: 'invalid_idempotent_request' }, 'failed', 'provider-idempotency-conflict'],
    [409, { code: 'concurrent_idempotent_requests' }, 'prepared', 'provider-request-in-progress'],
    [409, { message: 'invalid_idempotent_request' }, 'prepared', 'provider-conflict-unknown'],
    [409, { code: 'new_conflict' }, 'prepared', 'provider-conflict-unknown'],
    [401, {}, 'failed', 'provider-request-rejected'],
    [403, {}, 'failed', 'provider-request-rejected'],
    [422, {}, 'failed', 'provider-request-rejected'],
    [400, {}, 'failed', 'provider-request-rejected'],
    [202, { status: 'failed', message_id: null }, 'failed', 'provider-policy-rejected'],
    [202, { status: 'blocked', message_id: null }, 'failed', 'provider-policy-rejected'],
    [202, { status: 'canceled', message_id: null }, 'failed', 'provider-policy-rejected'],
    [202, { status: 'unsubscribed', message_id: null }, 'failed', 'provider-policy-rejected'],
    [202, { status: 'suppressed', message_id: null }, 'failed', 'provider-policy-rejected'],
    [202, { status: 'policy_rejected', message_id: null }, 'failed', 'provider-policy-rejected'],
    [202, { status: 'pending', message_id: 'recipient@example.test' }, 'prepared', 'provider-ambiguous'],
    [202, { status: 'pending', message_id: null }, 'prepared', 'provider-ambiguous'],
    [202, { status: 'unknown', message_id: 'valid-id' }, 'prepared', 'provider-ambiguous'],
    [200, { status: 'pending', message_id: 'valid-id' }, 'prepared', 'provider-ambiguous'],
    [302, {}, 'prepared', 'provider-ambiguous'],
  ] as const)('normalizes HTTP %i %j without exposing provider data', async (status, body, state, code) => {
    const { req, operationId } = await accept()
    const now = Date.now()
    const httpTransport = vi.fn(async () =>
      Response.json(
        { ...body, message: 'private provider response' },
        {
          status,
          headers: { 'Retry-After': '9999999' },
        },
      ),
    )
    const log = vi.fn()
    await createTransactionalEmailWorker(req, { ...providerOptions(), httpTransport, log, now: () => now }).run(
      operationId,
    )
    expect(httpTransport).toHaveBeenCalledOnce()
    const row = await stored(operationId)
    expect(row.state).toBe(state)
    if (status === 401 || status === 403) expect(payload.logger.fatal).toHaveBeenCalledWith(log.mock.calls[0]![0])
    else expect(payload.logger.fatal).not.toHaveBeenCalled()
    if (state === 'failed' && status !== 401 && status !== 403)
      expect(payload.logger.error).toHaveBeenCalledWith(log.mock.calls[0]![0])
    expect(log).toHaveBeenCalledWith({
      operationId,
      commandType: 'clinic.registration-received',
      attemptNumber: 1,
      environment: 'test',
      outcomeCode: code,
    })
    const events = await observer.query('SELECT outcome_code FROM transactional_email_events WHERE outbox_id = $1', [
      operationId,
    ])
    expect(events.rows).toContainEqual({ outcome_code: code })
    if (state === 'failed') {
      expect(row.prepared_provider_request).toBeNull()
      expect(row.next_attempt_at).toBeNull()
    } else {
      expect(row.prepared_provider_request).toBeTypeOf('string')
      expect(row.next_attempt_at.getTime()).toBe(now + 60000)
      expect(row.first_ambiguous_at?.getTime() ?? null).toBe(
        code.startsWith('provider-temporary') || code === 'provider-rate-limited' ? null : now,
      )
    }
  })

  it.each(['connection', 'response-body', 'delayed-response-body'] as const)(
    'bounds the entire %s wait at twenty seconds',
    async (phase) => {
      const { req, operationId } = await accept()
      const options = providerOptions()
      let started!: () => void
      const reached = new Promise<void>((resolve) => {
        started = resolve
      })
      let signal: AbortSignal | undefined
      let now = Date.now()
      const httpTransport: LettermintHttpTransport = vi.fn(async (_url, init) => {
        signal = init.signal
        started()
        if (phase === 'connection') return new Promise<Response>(() => undefined)
        if (phase === 'delayed-response-body') await new Promise((resolve) => setTimeout(resolve, 12000))
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{'))
            },
          }),
          { status: 202 },
        )
      })
      // Only timer APIs are virtual; real Payload I/O and lease timestamps remain explicit.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      try {
        const pending = createTransactionalEmailWorker(req, { ...options, httpTransport, now: () => now }).run(
          operationId,
        )
        await reached
        await vi.advanceTimersByTimeAsync(19999)
        expect(signal!.aborted).toBe(false)
        expect((await stored(operationId)).next_attempt_at).toBeNull()
        now += 20000
        await vi.advanceTimersByTimeAsync(1)
        await pending
        expect(signal!.aborted).toBe(true)
        const row = await stored(operationId)
        expect(row).toMatchObject({ state: 'prepared', attempt_count: '1', lease_token: null })
        expect(row.first_ambiguous_at.getTime()).toBe(now - 20000)
        expect(row.next_attempt_at.getTime()).toBe(now + 60000)
        expect(httpTransport).toHaveBeenCalledOnce()
      } finally {
        vi.useRealTimers()
      }
    },
  )

  it.each(['reset', 'truncated', 'oversized', 'invalid-utf8'] as const)(
    'retains the operation after a %s response',
    async (failure) => {
      const { req, operationId } = await accept()
      const log = vi.fn()
      const httpTransport = vi.fn(async () => {
        if (failure === 'reset') throw new Error('private connection failure')
        return new Response(
          failure === 'truncated'
            ? '{"message_id":'
            : failure === 'oversized'
              ? 'x'.repeat(65537)
              : new Uint8Array([0xff]),
          { status: 202 },
        )
      })
      await createTransactionalEmailWorker(req, { ...providerOptions(), httpTransport, log }).run(operationId)
      expect(await stored(operationId)).toMatchObject({ state: 'prepared', attempt_count: '1' })
      expect(log.mock.calls[0]![0].outcomeCode).toBe('provider-ambiguous')
      expect(httpTransport).toHaveBeenCalledOnce()
    },
  )

  it('preserves bytes, key, deadlines and the six-attempt schedule across recreation and token rotation', async () => {
    const { req, operationId } = await accept()
    let now = Date.now()
    const log = vi.fn()
    const httpTransport = vi.fn<LettermintHttpTransport>(async () =>
      Response.json({ code: 'concurrent_idempotent_requests' }, { status: 409, headers: { 'Retry-After': '1' } }),
    )
    await createTransactionalEmailWorker(req, { ...providerOptions(), httpTransport, log, now: () => now }).run(
      operationId,
    )
    const first = await stored(operationId)
    const rotated = createActivationFixture()
    const token = 'lm_synthetic_preview_rotated_token'
    rotated.configuration.secrets.preview.LETTERMINT_PROJECT_TOKEN = token
    const fingerprint = rotated.configuration.registry.fingerprints.find(
      (entry) => entry.kind === 'project-token' && entry.environment === 'preview',
    )!
    fingerprint.sha256 = createHash('sha256').update(token).digest('hex')
    rotated.preflight.credentials.projectToken.sha256 = fingerprint.sha256
    rotated.configuration.registry.targets[0]!.sender = 'changed@example.test'
    rotated.preflight.target.sender = 'changed@example.test'
    const options = providerOptions(rotated)
    const delays = [60000, 300000, 1800000, 7200000, 28800000]
    for (const [index, delay] of delays.entries()) {
      const waiting = await stored(operationId)
      expect(waiting.next_attempt_at.getTime()).toBe(now + delay)
      now += delay - 1
      await createTransactionalEmailWorker(req, { ...options, httpTransport, log, now: () => now }).run(operationId)
      expect(httpTransport).toHaveBeenCalledTimes(index + 1)
      now += 1
      await createTransactionalEmailWorker(req, { ...options, httpTransport, log, now: () => now }).run(operationId)
      const row = await stored(operationId)
      expect(row.delivery_deadline).toEqual(first.delivery_deadline)
      expect(row.first_ambiguous_at).toEqual(first.first_ambiguous_at)
      expect(row.provider_idempotency_key).toBe(first.provider_idempotency_key)
      expect(httpTransport.mock.calls[index + 1]![1]).toMatchObject({
        body: first.prepared_provider_request,
        headers: { 'x-lettermint-token': token, 'Idempotency-Key': first.provider_idempotency_key },
      })
    }
    expect(await stored(operationId)).toMatchObject({
      state: 'expired',
      attempt_count: '6',
      prepared_provider_request: null,
    })
    await createTransactionalEmailWorker(req, { ...options, httpTransport, now: () => now }).run(operationId)
    expect(httpTransport).toHaveBeenCalledTimes(6)
  })

  it.each(['teamId', 'projectId', 'routeId', 'environment'] as const)(
    'stops %s drift before another HTTP attempt',
    async (field) => {
      const { req, operationId } = await accept()
      let now = Date.now()
      const httpTransport = vi.fn(async () => new Response('', { status: 503 }))
      await createTransactionalEmailWorker(req, { ...providerOptions(), httpTransport, now: () => now }).run(
        operationId,
      )
      const before = await stored(operationId)
      const changed = createActivationFixture(field === 'environment' ? 'production' : 'preview')
      if (field !== 'environment') {
        changed.configuration.registry.targets[0]![field] += '-changed'
        changed.configuration.registry.targets[0]!.activatedTarget[field] += '-changed'
        changed.configuration.locks.targets[0]![field] += '-changed'
        changed.preflight.target[field] += '-changed'
        for (const fingerprint of changed.configuration.registry.fingerprints)
          if (fingerprint.environment === 'preview') fingerprint[field] += '-changed'
      }
      now += 60000
      await expect(
        createTransactionalEmailWorker(req, { ...providerOptions(changed), httpTransport, now: () => now }).run(
          operationId,
        ),
      ).rejects.toMatchObject({ code: 'environment-unavailable' })
      expect(httpTransport).toHaveBeenCalledOnce()
      const after = await stored(operationId)
      expect(after.prepared_provider_request).toBe(before.prepared_provider_request)
      expect(after.attempt_count).toBe('1')
    },
  )

  it.each(['preview', 'production'] as const)('keeps the %s token and target isolated', async (environment) => {
    const { req, operationId } = await accept()
    const options = providerOptions(createActivationFixture(environment))
    const httpTransport = vi.fn<LettermintHttpTransport>(async () => new Response('', { status: 503 }))
    await createTransactionalEmailWorker(req, { ...options, httpTransport }).run(operationId)
    const init = httpTransport.mock.calls[0]![1]
    expect(init.headers).toMatchObject({ 'x-lettermint-token': options.providerBinding.projectToken })
    expect(JSON.parse(init.body)).toMatchObject({ route: `route-${environment}`, metadata: { environment } })
    expect(await stored(operationId)).toMatchObject({
      provider_team_id: `team-${environment}`,
      provider_project_id: `project-${environment}`,
    })
  })

  it.each(['local', 'test', 'ci'] as const)('cannot select real network delivery in %s', (environment) => {
    vi.stubEnv('DEPLOYMENT_ENV', environment)
    vi.stubEnv('NODE_ENV', environment === 'local' ? 'development' : 'test')
    vi.stubEnv('CI', environment === 'ci' ? 'true' : 'false')
    expect(() => createLettermintDeliveryAdapter(createActivationFixture().binding)).toThrow('environment-unavailable')
  })

  it('expires before transport when the full delivery budget no longer fits', async () => {
    const { req, operationId } = await accept()
    const row = await stored(operationId)
    const now = row.delivery_deadline.getTime() - 25000
    const httpTransport = vi.fn(async () => new Response('', { status: 503 }))
    await createTransactionalEmailWorker(req, { ...providerOptions(), httpTransport, now: () => now }).run(operationId)
    expect(httpTransport).not.toHaveBeenCalled()
    expect(await stored(operationId)).toMatchObject({
      state: 'expired',
      prepared_provider_request: null,
      attempt_count: '0',
    })
  })
  it.each([
    'pending',
    'queued',
    'processed',
    'delivered',
    'opened',
    'clicked',
    'soft_bounced',
    'hard_bounced',
    'spam_complaint',
  ])('records acceptance for documented %s status without inferring delivery events', async (status) => {
    const { req, operationId } = await accept()
    const httpTransport = vi.fn(async () =>
      Response.json({ status, message_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' }, { status: 202 }),
    )
    await createTransactionalEmailWorker(req, { ...providerOptions(), httpTransport }).run(operationId)
    expect(await stored(operationId)).toMatchObject({ state: 'accepted', prepared_provider_request: null })
    expect(httpTransport).toHaveBeenCalledOnce()
  })
})
