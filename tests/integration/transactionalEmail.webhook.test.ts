import { createHash, createHmac, randomUUID } from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import pg from 'pg'
import { createLocalReq, getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { NextRequest } from 'next/server'
import { AppRouteRouteModule, type AppRouteUserlandModule } from 'next/dist/server/route-modules/app-route/module'
import type { RouteKind } from 'next/dist/server/route-kind'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createWebhookConfiguration,
  webhookConfiguration,
  webhookNow,
  webhookTestEvent,
} from '../fixtures/lettermintWebhook'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'
import { syntheticEmailCatalog, syntheticRegistrationId } from '../fixtures/transactionalEmail'
import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'
import { proxy } from '@/proxy'
import { loadHostedLettermintWebhookBinding } from '@/features/transactionalEmail/hostedConfiguration'

vi.hoisted(async () => {
  const { createRequire } = await import('node:module')
  createRequire(import.meta.url)('next/dist/server/node-environment-baseline')
})
vi.mock('@/features/transactionalEmail/lettermintRegistry.json', async () => ({
  default: (await import('../fixtures/lettermintWebhook')).webhookConfiguration.registry,
}))
vi.mock('@/features/transactionalEmail/lettermintTargetLocks.json', async () => ({
  default: (await import('../fixtures/lettermintWebhook')).webhookConfiguration.locks,
}))

describe('Lettermint webhook Next.js request boundary', () => {
  let observer: pg.Client
  let route: AppRouteRouteModule
  let beforeState: string
  let networkAttempts = 0
  let payload: Payload
  const requestErrors: unknown[] = []
  const logCalls: unknown[] = []
  const operationReference = randomUUID()

  const state = async () => {
    const { rows } = await observer.query(`
    SELECT 'outbox' AS kind, to_jsonb(o) AS record FROM transactional_email_outbox o
    UNION ALL SELECT 'event', to_jsonb(e) FROM transactional_email_events e
    ORDER BY kind, record
  `)
    return createHash('sha256').update(JSON.stringify(rows)).digest('hex')
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await bindTransactionalEmail(await createLocalReq({}, payload), syntheticEmailCatalog).accept({
      type: 'clinic.registration-received',
      operationReference,
      registrationId: syntheticRegistrationId,
    })
    observer = new pg.Client({ connectionString: process.env.DATABASE_URI })
    await observer.connect()
    route = new AppRouteRouteModule({
      definition: {
        kind: 'APP_ROUTE' as RouteKind.APP_ROUTE,
        page: '/api/internal/transactional-email/lettermint/[environment]/route',
        pathname: '/api/internal/transactional-email/lettermint/[environment]',
        filename: 'route',
        bundlePath: 'app/api/internal/transactional-email/lettermint/[environment]/route',
      },
      userland: async () =>
        // Next's generic dispatcher type omits this route's required environment parameter.
        (await import('@/app/api/internal/transactional-email/lettermint/[environment]/route')) as unknown as AppRouteUserlandModule,
      resolvedPagePath: 'src/app/api/internal/transactional-email/lettermint/[environment]/route.ts',
      distDir: '.next',
      relativeProjectDir: '.',
      nextConfigOutput: undefined,
    })
  })

  beforeEach(async () => {
    Object.assign(webhookConfiguration.registry, createWebhookConfiguration().registry)
    Object.assign(webhookConfiguration.secrets, createWebhookConfiguration().secrets)
    for (const [key, value] of Object.entries(webhookConfiguration.secrets.preview)) vi.stubEnv(key, value)
    vi.stubEnv('LETTERMINT_PREVIOUS_WEBHOOK_SECRET', undefined)
    vi.stubEnv('CI', 'false')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    vi.spyOn(Date, 'now').mockReturnValue(webhookNow)
    networkAttempts = 0
    requestErrors.length = 0
    logCalls.length = 0
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logCalls.push(args)
      })
    }
    const deny = () => {
      networkAttempts++
      throw new Error('External network forbidden by webhook contract')
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(deny)
    vi.spyOn(http, 'request').mockImplementation(deny)
    vi.spyOn(https, 'request').mockImplementation(deny)
    vi.spyOn(http, 'get').mockImplementation(deny)
    vi.spyOn(https, 'get').mockImplementation(deny)
    vi.spyOn(net.Socket.prototype, 'connect').mockImplementation(deny)
    vi.spyOn(tls, 'connect').mockImplementation(deny)
    beforeState = await state()
  })

  afterEach(async () => {
    expect(await state()).toEqual(beforeState)
    expect(networkAttempts).toBe(0)
    expect(requestErrors).toHaveLength(0)
    expect(logCalls).toHaveLength(0)
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })
  afterAll(async () => {
    if (payload) await cleanupTransactionalEmailFixtures(payload, [operationReference])
    await observer?.end()
  })

  const send = async (
    options: {
      body?: string | Uint8Array
      stream?: ReadableStream<Uint8Array>
      signedBody?: string | Uint8Array
      timestamp?: number
      secret?: string
      signature?: string | null
      contentType?: string | null
      headers?: Record<string, string>
      environment?: string
      protocol?: string
      method?: string
    } = {},
  ) => {
    const body = options.body ?? JSON.stringify(webhookTestEvent())
    const timestamp = String(options.timestamp ?? webhookNow / 1000)
    const signature = createHmac(
      'sha256',
      options.secret ?? webhookConfiguration.secrets.preview.LETTERMINT_WEBHOOK_SECRET!,
    )
      .update(`${timestamp}.`)
      .update(options.signedBody ?? body)
      .digest('hex')
    const headers = new Headers({
      'x-lettermint-event': 'webhook.test',
      ...options.headers,
    })
    if (options.contentType !== null) headers.set('content-type', options.contentType ?? 'application/json')
    if (options.signature !== null)
      headers.set('x-lettermint-signature', options.signature ?? `t=${timestamp},v1=${signature}`)
    const environment = options.environment ?? 'preview'
    const url = `${options.protocol ?? 'https:'}//webhook.example.test/api/internal/transactional-email/lettermint/${environment}`
    const request = new NextRequest(url, {
      method: options.method ?? 'POST',
      body: options.method === 'GET' ? undefined : (options.stream ?? new Uint8Array(Buffer.from(body))),
      headers,
    })
    const guarded = await proxy(request)
    if (guarded.headers.get('x-middleware-next') !== '1') return guarded
    return route.handle(request, {
      params: { environment },
      renderOpts: {
        supportsDynamicResponse: true,
        waitUntil: undefined,
        onClose: () => {},
        onAfterTaskError: undefined,
        onInstrumentationRequestError: async (error) => {
          requestErrors.push(error)
        },
        experimental: { authInterrupts: false, useCacheTimeout: 5000 },
        cacheLifeProfiles: { default: { stale: 0, revalidate: 0, expire: 0 } },
        staticPageGenerationTimeout: 60,
        cacheComponents: false,
        validationLevel: 'warning',
      },
      previewProps: { previewModeId: '', previewModeEncryptionKey: '', previewModeSigningKey: '' },
      sharedContext: { buildId: 'test', deploymentId: '' },
    })
  }

  it('acknowledges an authenticated test event without persistent mutations or provider calls', async () => {
    const response = await send()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ outcomeCode: 'webhook-test-verified' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('withholds sending and digest credentials from the inbound capability at runtime', () => {
    const binding = loadHostedLettermintWebhookBinding('preview')
    expect('projectToken' in binding).toBe(false)
    expect('digestKey' in binding).toBe(false)
    expect(JSON.stringify(binding).includes(webhookConfiguration.secrets.preview.LETTERMINT_WEBHOOK_SECRET!)).toBe(
      false,
    )
  })

  it.each([null, 'text/plain', 'application/jsonp', 'application/json; charset=iso-8859-1'])(
    'rejects unsupported content type %s',
    async (contentType) => {
      expect((await send({ contentType })).status).toBe(415)
    },
  )

  it('rejects cleartext requests even when a caller supplies a forwarded HTTPS header', async () => {
    expect((await send({ protocol: 'http:', headers: { 'x-forwarded-proto': 'https' } })).status).toBe(400)
  })

  it.each([
    null,
    '',
    'invalid',
    't=no,v1=bad',
    't=1.5,v1=' + 'a'.repeat(64),
    't=1790424000,v1=' + 'a'.repeat(63),
    't=1790424000,v1=' + 'g'.repeat(64),
    't=1790424000,t=1790424000,v1=' + 'a'.repeat(64),
    't=1790424000,v1=' + 'a'.repeat(64) + ',v1=' + 'b'.repeat(64),
  ])('rejects an absent, malformed or duplicated signature header, case %#', async (signature) => {
    expect((await send({ signature, body: '{invalid-json' })).status).toBe(401)
  })

  it.each([-301, 301])(
    'rejects a correctly signed request outside the timestamp tolerance by %i seconds',
    async (offset) => {
      expect((await send({ timestamp: webhookNow / 1000 + offset })).status).toBe(401)
    },
  )
  it.each([-300, 300])('accepts the inclusive timestamp boundary at %i seconds', async (offset) => {
    expect((await send({ timestamp: webhookNow / 1000 + offset })).status).toBe(200)
  })

  it('authenticates whitespace, UTF-8 and property ordering as exact bytes', async () => {
    const body = JSON.stringify({ ...webhookTestEvent(), ignored: 'Grüße 世界' }, null, 2)
    expect((await send({ body })).status).toBe(200)
    expect((await send({ body: body + ' ', signedBody: body })).status).toBe(401)
    expect((await send({ body: JSON.stringify(JSON.parse(body)), signedBody: body })).status).toBe(401)
  })

  it('authenticates before parsing malformed JSON or decoding invalid UTF-8', async () => {
    for (const body of ['{synthetic-private-invalid-json', new Uint8Array([0xff, 0xfe])]) {
      expect((await send({ body, secret: 'whsec_synthetic_wrong_secret' })).status).toBe(401) // pragma: allowlist secret
      const response = await send({ body })
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ outcomeCode: 'webhook-invalid' })
    }
  })

  it('rejects a fixed-length oversized body before pulling any bytes', async () => {
    let pulls = 0
    const stream = new ReadableStream<Uint8Array>(
      {
        pull() {
          pulls++
        },
      },
      { highWaterMark: 0 },
    )
    const response = await send({ stream, headers: { 'content-length': String(256 * 1024 + 1) } })
    expect(response.status).toBe(413)
    expect(pulls).toBe(0)
  }, 1000)

  it.each([undefined, '1'])('stops an oversized chunked stream without trusting length %s', async (length) => {
    let chunks = 0
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          chunks++
          controller.enqueue(new Uint8Array(64 * 1024))
        },
        cancel() {
          cancelled = true
        },
      },
      { highWaterMark: 0 },
    )
    const response = await send({ stream, headers: length ? { 'content-length': length } : {} })
    expect(response.status).toBe(413)
    expect(chunks).toBe(5)
    expect(cancelled).toBe(true)
  })

  it('accepts exactly 256 KiB and counts UTF-8 bytes rather than characters', async () => {
    const original = JSON.stringify(webhookTestEvent())
    const body = original + ' '.repeat(256 * 1024 - Buffer.byteLength(original))
    expect((await send({ body })).status).toBe(200)
    expect((await send({ body: JSON.stringify({ ...webhookTestEvent(), ignored: 'é'.repeat(140_000) }) })).status).toBe(
      413,
    )
  })

  it.each(['team_id', 'project_id', 'route_id'] as const)('rejects a signed foreign %s', async (field) => {
    const event = webhookTestEvent()
    event.context[field] = 'foreign-target'
    expect((await send({ body: JSON.stringify(event) })).status).toBe(403)
  })

  it('rejects a different endpoint environment, event header or webhook identity', async () => {
    expect((await send({ environment: 'production' })).status).toBe(403)
    expect((await send({ headers: { 'x-lettermint-event': 'message.created' } })).status).toBe(403)
    const event = webhookTestEvent()
    event.data.webhook_id = 'foreign-webhook'
    expect((await send({ body: JSON.stringify(event) })).status).toBe(403)
  })

  it('rejects conflicting explicit environment metadata on a signed test event', async () => {
    const event = webhookTestEvent()
    const body = JSON.stringify({ ...event, data: { ...event.data, metadata: { environment: 'production' } } })
    expect((await send({ body })).status).toBe(403)
  })

  const rotate = () => {
    const previous = 'whsec_synthetic_preview_previous' // pragma: allowlist secret
    vi.stubEnv('LETTERMINT_PREVIOUS_WEBHOOK_SECRET', previous)
    webhookConfiguration.registry.fingerprints.push({
      ...webhookConfiguration.registry.fingerprints.find(
        (entry) => entry.environment === 'preview' && entry.kind === 'webhook-current',
      )!,
      kind: 'webhook-previous',
      bindingId: 'preview-webhook-previous',
      sha256: createHash('sha256').update(previous).digest('hex'),
      overlap: {
        startsAt: new Date(webhookNow - 300_000).toISOString(),
        validUntil: new Date(webhookNow + 300_000).toISOString(),
      },
    })
    return previous
  }

  it('accepts both reviewed rotation secrets while retaining the five-minute signature limit', async () => {
    const previous = rotate()
    expect((await send()).status).toBe(200)
    expect((await send({ secret: previous })).status).toBe(200)
    expect((await send({ secret: previous, timestamp: webhookNow / 1000 - 301 })).status).toBe(401)
  })

  it('rejects a previous secret whose window expires while the request streams', async () => {
    const previous = rotate()
    webhookConfiguration.registry.fingerprints.at(-1)!.overlap!.validUntil = new Date(webhookNow + 1).toISOString()
    const body = JSON.stringify(webhookTestEvent())
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          vi.mocked(Date.now).mockReturnValue(webhookNow + 2)
          controller.enqueue(Buffer.from(body))
          controller.close()
        },
      },
      { highWaterMark: 0 },
    )
    expect((await send({ stream, secret: previous })).status).toBe(401)
  })

  it.each(['expired', 'future', 'too-long', 'wrong-fingerprint', 'duplicate'])(
    'fails closed for %s previous-secret configuration',
    async (fault) => {
      const previous = rotate()
      const entry = webhookConfiguration.registry.fingerprints.at(-1)!
      if (fault === 'expired') entry.overlap!.validUntil = new Date(webhookNow - 1).toISOString()
      if (fault === 'future') entry.overlap!.startsAt = new Date(webhookNow + 1).toISOString()
      if (fault === 'too-long') entry.overlap!.validUntil = new Date(webhookNow + 300_001).toISOString()
      if (fault === 'wrong-fingerprint') entry.sha256 = '0'.repeat(64)
      if (fault === 'duplicate') webhookConfiguration.registry.fingerprints.push({ ...entry })
      expect((await send({ secret: previous })).status).toBe(503)
    },
  )

  it('stops an unfinished stream after five seconds without waiting for cancellation', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let cancelled = false
    let started!: () => void
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    const stream = new ReadableStream<Uint8Array>(
      {
        pull() {
          started()
        },
        cancel() {
          cancelled = true
          return new Promise<void>(() => {})
        },
      },
      { highWaterMark: 0 },
    )
    try {
      const response = send({ stream })
      await ready
      await vi.advanceTimersByTimeAsync(5000)
      expect((await response).status).toBe(503)
      expect(cancelled).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  }, 1000)

  it('keeps provider content out of responses, logs, telemetry and persistent records', async () => {
    const event = webhookTestEvent()
    const privateValue = 'synthetic-private-content-recipient@example.test'
    const body = JSON.stringify({
      ...event,
      unapproved: privateValue,
      data: {
        ...event.data,
        subject: privateValue,
        recipient: privateValue,
        reason: privateValue,
        response: { content: privateValue },
        tags: [{ name: 'private', value: privateValue }],
        metadata: { environment: 'preview', unapproved: privateValue },
      },
    })
    const response = await send({ body })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ outcomeCode: 'webhook-test-verified' })
    const stream = new ReadableStream<Uint8Array>(
      {
        pull() {
          throw new Error(privateValue)
        },
      },
      { highWaterMark: 0 },
    )
    const failed = await send({ stream })
    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({ outcomeCode: 'webhook-unavailable' })
  })

  it.each(['message.created', 'message.delivered', 'message.opened', 'suppression.added', 'unknown'])(
    'rejects unsupported event %s without applying provider effects',
    async (event) => {
      expect(
        (
          await send({
            body: JSON.stringify({ ...webhookTestEvent(), event }),
            headers: { 'x-lettermint-event': event },
          })
        ).status,
      ).toBe(422)
    },
  )

  it.each(['id', 'timestamp', 'context', 'data'] as const)('rejects a verified envelope without %s', async (field) => {
    const event = webhookTestEvent()
    Reflect.deleteProperty(event, field)
    expect((await send({ body: JSON.stringify(event) })).status).toBe(422)
  })

  it('accepts Production only with its own signature, context, endpoint and runtime binding', async () => {
    const productionBody = JSON.stringify(webhookTestEvent('production'))
    const productionSecret = webhookConfiguration.secrets.production.LETTERMINT_WEBHOOK_SECRET!
    expect((await send({ body: productionBody, secret: productionSecret })).status).toBe(401)
    expect((await send({ body: productionBody })).status).toBe(403)
    for (const [key, value] of Object.entries(webhookConfiguration.secrets.production)) vi.stubEnv(key, value)
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    expect((await send({ environment: 'production', body: productionBody, secret: productionSecret })).status).toBe(200)
    expect((await send({ environment: 'production', body: productionBody })).status).toBe(401)
  })

  it.each(['local', 'test', 'ci', 'unknown'])('keeps the webhook unavailable in %s', async (environment) => {
    for (const key of Object.keys(webhookConfiguration.secrets.preview)) vi.stubEnv(key, undefined)
    vi.stubEnv('VERCEL_ENV', undefined)
    vi.stubEnv('DEPLOYMENT_ENV', environment)
    vi.stubEnv('NODE_ENV', 'development')
    expect((await send()).status).toBe(503)
  })

  it('fails closed when a deployment secret does not match its reviewed fingerprint', async () => {
    vi.stubEnv('LETTERMINT_WEBHOOK_SECRET', webhookConfiguration.secrets.production.LETTERMINT_WEBHOOK_SECRET!)
    expect((await send({ secret: webhookConfiguration.secrets.production.LETTERMINT_WEBHOOK_SECRET! })).status).toBe(
      503,
    )
  })

  it('rechecks signature age after streaming and rejects duplicate valid headers', async () => {
    const timestamp = webhookNow / 1000
    const body = JSON.stringify(webhookTestEvent())
    const signature = createHmac('sha256', webhookConfiguration.secrets.preview.LETTERMINT_WEBHOOK_SECRET!)
      .update(`${timestamp}.${body}`)
      .digest('hex')
    expect((await send({ signature: `t=${timestamp},v1=${signature},t=${timestamp}` })).status).toBe(401)
    expect((await send({ signature: `t=${timestamp},v1=${signature},v1=${signature}` })).status).toBe(401)
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          vi.mocked(Date.now).mockReturnValue(webhookNow + 1001)
          controller.enqueue(Buffer.from(body))
          controller.close()
        },
      },
      { highWaterMark: 0 },
    )
    expect((await send({ stream, timestamp: timestamp - 300 })).status).toBe(401)
  })

  it('leaves non-POST methods to Next.js method rejection', async () => {
    expect((await send({ method: 'GET' })).status).toBe(405)
  })

  it('authenticates webhook requests independently of caller-supplied session headers', async () => {
    const headers = {
      authorization: 'Bearer synthetic-foreign-session',
      cookie: 'sb-synthetic-auth-token=foreign-session',
    }
    expect((await send({ headers })).status).toBe(200)
    expect((await send({ headers, signature: null })).status).toBe(401)
  })

  it.each([
    '/api/internal/transactional-email/lettermint/preview/other',
    '/api/internal/transactional-email/lettermint/production/other',
    '/api/internal/transactional-email/lettermint/unknown',
    '/api/internal/transactional-email/other',
  ])('retains the Preview session guard for neighboring path %s', async (path) => {
    const response = await proxy(new NextRequest(`https://webhook.example.test${path}`, { method: 'POST' }))
    expect(response.status).toBe(401)
  })
})
