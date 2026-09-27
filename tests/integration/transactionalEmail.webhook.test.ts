const { closeDeliveryEdgeNetworkBoundary, deliveryEdgeNetworkGuard: networkGuard } = await vi.hoisted(
  () => import('../helpers/deliveryEdgeNetworkBoundary'),
)
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import { resolveActivationPolicy } from '@/features/transactionalEmail/activationPolicy'
import { createActivationFixture } from '../fixtures/transactionalEmailActivation'
import { recipientAddressDigest } from '@/features/transactionalEmail/recipientBinding'
import type { CommandCatalog } from '@/features/transactionalEmail/catalog'
import { retireDigestKey } from '@/features/transactionalEmail/digestKeyRotation'
import { validateTransactionalEmailStartup } from '@/features/transactionalEmail/environment'
import { runDigestKeyRetirement } from '../../scripts/lettermint-digest-key-retirement'
import { validateDeliveryEdgeLog } from '@/features/transactionalEmail/operationalSignals'
import { fallbackConsoleLogger } from '@/utilities/logging/consoleLogger'

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
  let payload: Payload
  const requestErrors: unknown[] = []
  const logCalls: unknown[] = []
  const signalCalls: unknown[] = []
  const expectedSignals: { outcomeCode: string }[] = []
  let recipientAddress = 'recipient@example.test'
  const originalEntry = syntheticEmailCatalog['clinic.registration-received']!
  const catalog: CommandCatalog = {
    'clinic.registration-received': {
      ...originalEntry,
      authorizeAndResolve: async (...args) => ({
        ...(await originalEntry.authorizeAndResolve(...args)),
        address: recipientAddress,
      }),
      worker: {
        ...originalEntry.worker!,
        revalidate: async (command) => {
          const current = await originalEntry.worker!.revalidate(command)
          return current ? { ...current, address: recipientAddress } : null
        },
      },
    },
  }
  const operationReference = randomUUID()
  const references = [operationReference]
  let mutationExpected = false
  const raceCleanup = new Set<() => void>()
  const raceWork = new Set<Promise<unknown>>()

  const state = async () => {
    const { rows } = await observer.query(`
    SELECT 'outbox' AS kind, to_jsonb(o) AS record FROM transactional_email_outbox o
    UNION ALL SELECT 'event', to_jsonb(e) FROM transactional_email_events e
    UNION ALL SELECT 'suppression', to_jsonb(s) FROM transactional_email_suppressions s
    ORDER BY kind, record
  `)
    return createHash('sha256').update(JSON.stringify(rows)).digest('hex')
  }

  beforeAll(async () => {
    expect(networkGuard.isInstalled()).toBe(true)
    payload = await getPayload({ config })
    await bindTransactionalEmail(await createLocalReq({}, payload), catalog).accept({
      type: 'clinic.registration-received',
      operationReference,
      registrationId: syntheticRegistrationId,
    })
    observer = new pg.Client({ connectionString: process.env.DATABASE_URI })
    await observer.connect()
    // Warm the two PostgreSQL connections needed by coordinated races through the exact test-database allowance.
    const transactions = await Promise.all([payload.db.beginTransaction(), payload.db.beginTransaction()])
    for (const id of transactions) if (id !== null) await payload.db.rollbackTransaction(id)
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
    recipientAddress = `${randomUUID()}@example.test`
    Object.assign(webhookConfiguration.registry, createWebhookConfiguration().registry)
    Object.assign(webhookConfiguration.secrets, createWebhookConfiguration().secrets)
    for (const [key, value] of Object.entries(webhookConfiguration.secrets.preview)) vi.stubEnv(key, value)
    vi.stubEnv('LETTERMINT_PREVIOUS_WEBHOOK_SECRET', undefined)
    vi.stubEnv('CI', 'false')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    vi.spyOn(Date, 'now').mockReturnValue(webhookNow)
    requestErrors.length = 0
    logCalls.length = 0
    signalCalls.length = 0
    expectedSignals.length = 0
    vi.spyOn(payload.logger, 'warn').mockImplementation((...args: unknown[]) => {
      signalCalls.push(...args)
    })
    vi.spyOn(fallbackConsoleLogger, 'warn').mockImplementation((...args: unknown[]) => {
      signalCalls.push(...args)
    })
    for (const method of ['log', 'info', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logCalls.push(args)
      })
    }
    beforeState = await state()
    mutationExpected = false
  })

  afterEach(async () => {
    try {
      // Release every participant before awaiting any of them, including after a test timeout.
      for (const cleanup of raceCleanup) cleanup()
      await Promise.allSettled(raceWork)
      raceWork.clear()
      if (!mutationExpected) expect(await state()).toEqual(beforeState)
      networkGuard.assertNoAttempts()
      expect(requestErrors).toHaveLength(0)
      expect(logCalls).toHaveLength(0)
      expect(signalCalls.map((signal) => validateDeliveryEdgeLog(signal).outcomeCode)).toEqual(
        expect.arrayContaining(expectedSignals.map(({ outcomeCode }) => outcomeCode)),
      )
    } finally {
      vi.restoreAllMocks()
      vi.unstubAllEnvs()
      networkGuard.reinstall()
      networkGuard.resetAttempts()
    }
  })
  afterAll(async () => {
    try {
      if (payload) await cleanupTransactionalEmailFixtures(payload, references)
      await observer?.end()
      networkGuard.assertNoAttempts()
    } finally {
      closeDeliveryEdgeNetworkBoundary()
    }
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

  async function preparedOperation(
    environment: 'preview' | 'production' = 'preview',
    initialOutcome: 'ambiguous' | 'permanent' = 'ambiguous',
  ) {
    // Build durable provider bytes through the real worker with synthetic dependencies only.
    vi.unstubAllEnvs()
    vi.stubEnv('CI', 'false')
    const req = await createLocalReq({}, payload)
    const reference = randomUUID()
    references.push(reference)
    const { operationId } = await bindTransactionalEmail(req, catalog).accept({
      type: 'clinic.registration-received',
      operationReference: reference,
      registrationId: syntheticRegistrationId,
    })
    const fixture = createActivationFixture(environment)
    await createTransactionalEmailWorker(req, {
      catalog,
      now: () => webhookNow,
      suppression: async () => 'cleared',
      providerBinding: fixture.binding,
      activationPolicy: resolveActivationPolicy(
        fixture.binding,
        fixture.registry,
        environment === 'preview'
          ? [
              recipientAddressDigest(recipientAddress, {
                version: fixture.binding.target.digestKeyId,
                secret: fixture.binding.digestKey,
              })!,
            ]
          : undefined,
      ),
      delivery: { deliver: async () => ({ type: initialOutcome }) },
      log: () => {},
    }).run(operationId)
    // Only fixture setup changes deployment identity; the request uses unmodified collection guards.
    await observer.query('UPDATE transactional_email_outbox SET runtime_environment = $1 WHERE id = $2', [
      environment,
      operationId,
    ])
    for (const [key, value] of Object.entries(webhookConfiguration.secrets[environment])) vi.stubEnv(key, value)
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', environment)
    vi.stubEnv('DEPLOYMENT_ENV', environment)
    beforeState = await state()
    return operationId
  }

  const messageEvent = (operationId: string, event: string) => ({
    ...webhookTestEvent(),
    id: randomUUID(),
    event,
    data: {
      message_id: 'synthetic-message',
      recipient: recipientAddress,
      metadata: { operation_id: operationId, command_type: 'clinic.registration-received', environment: 'preview' },
    },
  })
  const sendEvent = (event: ReturnType<typeof messageEvent>) =>
    send({ body: JSON.stringify(event), headers: { 'x-lettermint-event': event.event } })

  it('commits a verified hard bounce with one private address suppression', async () => {
    const id = await preparedOperation()
    mutationExpected = true
    expect((await sendEvent(messageEvent(id, 'message.hard_bounced'))).status).toBe(200)
    const { rows } = await observer.query(
      "SELECT reason, source FROM transactional_email_suppressions WHERE runtime_environment = 'preview' AND recipient_digest = (SELECT provider_recipient_digest FROM transactional_email_outbox WHERE id = $1)",
      [id],
    )
    expect(rows).toEqual([{ reason: 'hard-bounce', source: 'lettermint' }])
  })

  it('correlates a retained previous-version outbox digest while writing only the current suppression version', async () => {
    const id = await preparedOperation()
    const rotated = createActivationFixture('preview', false, true)
    Object.assign(webhookConfiguration.registry, rotated.configuration.registry)
    Object.assign(webhookConfiguration.secrets, rotated.configuration.secrets)
    for (const [key, value] of Object.entries(rotated.configuration.secrets.preview)) vi.stubEnv(key, value)

    mutationExpected = true
    expect(await (await sendEvent(messageEvent(id, 'message.spam_complaint'))).json()).toEqual({
      outcomeCode: 'provider-event-applied',
    })
    const candidateDigests = rotated.binding.recipientDigestKeys.map((key) =>
      recipientAddressDigest(recipientAddress, key)!,
    )
    expect(
      (
        await observer.query(
          "SELECT split_part(provider_recipient_digest, ':', 1) AS version FROM transactional_email_outbox WHERE id = $1",
          [id],
        )
      ).rows,
    ).toEqual([{ version: rotated.binding.recipientDigestKeys[1]!.version }])
    const { rows } = await observer.query(
      `SELECT split_part(recipient_digest, ':', 1) AS version, reason
         FROM transactional_email_suppressions
        WHERE runtime_environment = 'preview'
          AND recipient_digest = ANY($1::text[])
        ORDER BY version`,
      [candidateDigests],
    )
    expect(rows).toEqual([
      {
        version: rotated.binding.recipientDigestKeys[0]!.version,
        reason: 'spam-complaint',
      },
    ])
  })

  it('writes only the current digest version for new provider preparation after rotation', async () => {
    mutationExpected = true
    vi.unstubAllEnvs()
    vi.stubEnv('CI', 'false')
    const req = await createLocalReq({}, payload)
    const reference = randomUUID()
    references.push(reference)
    const { operationId } = await bindTransactionalEmail(req, catalog).accept({
      type: 'clinic.registration-received',
      operationReference: reference,
      registrationId: syntheticRegistrationId,
    })
    const rotated = createActivationFixture('preview', false, true)
    const currentKey = rotated.binding.recipientDigestKeys[0]!
    await createTransactionalEmailWorker(req, {
      catalog,
      providerBinding: rotated.binding,
      activationPolicy: resolveActivationPolicy(rotated.binding, rotated.registry, [
        recipientAddressDigest(recipientAddress, currentKey)!,
      ]),
      delivery: { deliver: async () => ({ type: 'ambiguous' }) },
      log: () => {},
    }).run(operationId)

    expect(
      (
        await observer.query(
          "SELECT split_part(provider_recipient_digest, ':', 1) AS version FROM transactional_email_outbox WHERE id = $1",
          [operationId],
        )
      ).rows[0].version,
    ).toBe(currentKey.version)
  })

  it('ignores a suppression stored under a digest version that is not explicitly configured', async () => {
    mutationExpected = true
    vi.unstubAllEnvs()
    vi.stubEnv('CI', 'false')
    const req = await createLocalReq({}, payload)
    const reference = randomUUID()
    references.push(reference)
    const { operationId } = await bindTransactionalEmail(req, catalog).accept({
      type: 'clinic.registration-received',
      operationReference: reference,
      registrationId: syntheticRegistrationId,
    })
    const fixture = createActivationFixture()
    const currentKey = fixture.binding.recipientDigestKeys[0]!
    const unconfiguredDigest = recipientAddressDigest(recipientAddress, {
      version: `unconfigured-${randomUUID()}`,
      secret: 'synthetic-unconfigured-digest-key', // pragma: allowlist secret
    })!
    const observedAt = new Date(webhookNow).toISOString()
    await observer.query(
      `INSERT INTO transactional_email_suppressions
        (runtime_environment, recipient_digest, reason, first_observed_at, last_observed_at, source, created_at, updated_at)
       VALUES ('preview', $1, 'hard-bounce', $2, $2, 'lettermint', $2, $2)`,
      [unconfiguredDigest, observedAt],
    )
    const delivery = { deliver: vi.fn(async () => ({ type: 'ambiguous' as const })) }
    try {
      await createTransactionalEmailWorker(req, {
        catalog,
        links: { generate: async () => 'https://example.test/synthetic-action' },
        delivery,
        log: () => {},
        providerBinding: fixture.binding,
        activationPolicy: resolveActivationPolicy(fixture.binding, fixture.registry, [
          recipientAddressDigest(recipientAddress, currentKey)!,
        ]),
      }).run(operationId)
      expect(delivery.deliver).toHaveBeenCalledOnce()
      expect((await stored(operationId)).state).not.toBe('suppressed')
      expect(
        (
          await observer.query(
            `SELECT reason, source, first_observed_at, last_observed_at
               FROM transactional_email_suppressions
              WHERE runtime_environment = 'preview' AND recipient_digest = $1`,
            [unconfiguredDigest],
          )
        ).rows,
      ).toEqual([
        {
          reason: 'hard-bounce',
          source: 'lettermint',
          first_observed_at: new Date(observedAt),
          last_observed_at: new Date(observedAt),
        },
      ])
    } finally {
      await observer.query(
        "DELETE FROM transactional_email_suppressions WHERE runtime_environment = 'preview' AND recipient_digest = $1",
        [unconfiguredDigest],
      )
    }
  })

  const stored = async (id: string) =>
    (await observer.query('SELECT *, latest_event_sequence::int FROM transactional_email_outbox WHERE id = $1', [id]))
      .rows[0]
  const history = async (id: string) =>
    (
      await observer.query(
        'SELECT *, sequence::int FROM transactional_email_events WHERE outbox_id = $1 ORDER BY transactional_email_events.sequence',
        [id],
      )
    ).rows

  const suppressionsFor = async (id: string) =>
    (
      await observer.query(
        `SELECT runtime_environment, reason, source, first_observed_at, last_observed_at
     FROM transactional_email_suppressions WHERE recipient_digest =
     (SELECT provider_recipient_digest FROM transactional_email_outbox WHERE id = $1)`,
        [id],
      )
    ).rows

  it('keeps complaint suppression after replay and later hard bounces without extending it on duplicates', async () => {
    const id = await preparedOperation()
    mutationExpected = true
    const bounce = messageEvent(id, 'message.hard_bounced')
    expect((await sendEvent(bounce)).status).toBe(200)
    const complaint = { ...messageEvent(id, 'message.spam_complaint'), timestamp: '2026-09-26T12:01:00.000Z' }
    expect((await sendEvent(complaint)).status).toBe(200)
    const laterBounce = { ...messageEvent(id, 'message.hard_bounced'), timestamp: '2026-09-26T12:02:00.000Z' }
    expect((await sendEvent(laterBounce)).status).toBe(200)
    expect(await suppressionsFor(id)).toEqual([
      {
        runtime_environment: 'preview',
        reason: 'spam-complaint',
        source: 'lettermint',
        first_observed_at: new Date(bounce.timestamp),
        last_observed_at: new Date(laterBounce.timestamp),
      },
    ])
    const committed = await state()
    const replaySignalOffset = signalCalls.length
    expect(await (await sendEvent(complaint)).json()).toEqual({ outcomeCode: 'provider-event-duplicate' })
    expect(signalCalls.slice(replaySignalOffset)).toEqual([
      {
        operationId: id,
        environment: 'preview',
        outcomeCode: 'provider-event-duplicate',
        providerEventId: complaint.id,
        providerEventType: 'message.spam_complaint',
        providerMessageId: 'synthetic-message',
      },
    ])
    expect(await state()).toEqual(committed)
    expect((await stored(id)).state).toBe('bounced')
  })

  it.each(['recipient', 'missing-digest', 'foreign-digest'])(
    'rejects a verified suppression %s mismatch without any effect',
    async (mismatch) => {
      const id = await preparedOperation()
      const event = messageEvent(id, 'message.spam_complaint')
      if (mismatch === 'recipient') event.data.recipient = 'another@example.test'
      else
        await observer.query('UPDATE transactional_email_outbox SET provider_recipient_digest = $1 WHERE id = $2', [
          mismatch === 'missing-digest'
            ? null
            : recipientAddressDigest(recipientAddress, {
                version: 'digest-production',
                secret: webhookConfiguration.secrets.production.LETTERMINT_RECIPIENT_DIGEST_KEY!,
              }),
          id,
        ])
      beforeState = await state()
      expectedSignals.push({ outcomeCode: 'provider-event-mismatch' })
      expect(await (await sendEvent(event)).json()).toEqual({ outcomeCode: 'provider-event-mismatch' })
      expect(await state()).toEqual(beforeState)
    },
  )

  it.each([undefined, null, [], '', 'invalid-address'])(
    'rejects suppression feedback without a valid recipient',
    async (recipient) => {
      const id = await preparedOperation()
      const base = messageEvent(id, 'message.hard_bounced')
      const response = await send({
        body: JSON.stringify({ ...base, data: { ...base.data, recipient } }),
        headers: { 'x-lettermint-event': base.event },
      })
      expect(response.status).toBe(422)
    },
  )

  it('checks persisted suppression before link, rendering, serialization and controlled transport despite caller clearance', async () => {
    const id = await preparedOperation()
    mutationExpected = true
    const event = messageEvent(id, 'message.spam_complaint')
    event.data.recipient = `  ${recipientAddress.toUpperCase()}  `
    expect((await sendEvent(event)).status).toBe(200)
    vi.unstubAllEnvs()
    vi.stubEnv('CI', 'false')
    const req = await createLocalReq({}, payload)
    const reference = randomUUID()
    references.push(reference)
    const receipt = await bindTransactionalEmail(req, catalog).accept({
      type: 'clinic.registration-received',
      operationReference: reference,
      registrationId: syntheticRegistrationId,
    })
    const fixture = createActivationFixture()
    const links = {
      generate: vi.fn(async () => {
        throw new Error('Unexpected auth link generation')
      }),
    }
    const httpTransport = vi.fn(async () => {
      throw new Error('Unexpected provider transport')
    })
    const suppression = vi.fn(async () => 'cleared' as const)
    await createTransactionalEmailWorker(req, {
      catalog,
      now: () => webhookNow,
      links,
      httpTransport,
      suppression,
      providerBinding: fixture.binding,
      activationPolicy: resolveActivationPolicy(fixture.binding, fixture.registry, [
        recipientAddressDigest(recipientAddress, {
          version: fixture.binding.target.digestKeyId,
          secret: fixture.binding.digestKey,
        })!,
      ]),
    }).run(receipt.operationId)
    expect(links.generate).not.toHaveBeenCalled()
    expect(httpTransport).not.toHaveBeenCalled()
    expect(suppression).not.toHaveBeenCalled()
    const record = await stored(receipt.operationId)
    expect(record).toMatchObject({
      state: 'suppressed',
      prepared_at: null,
      prepared_provider_request: null,
      recipient_address: null,
      command_payload: null,
      attempt_count: '0',
    })
    expect((await history(receipt.operationId)).map((entry) => entry.type)).toEqual([
      'command.accepted',
      'lease.acquired',
      'delivery.suppressed',
      'payload.scrubbed',
    ])
    expect(JSON.stringify([logCalls, signalCalls, requestErrors]).includes(recipientAddress)).toBe(false)
    expect(
      JSON.stringify([logCalls, signalCalls, requestErrors]).includes((await stored(id)).provider_recipient_digest),
    ).toBe(false)
  })

  it('materializes the current digest atomically when a previous-version suppression blocks preparation', async () => {
    const sourceId = await preparedOperation()
    mutationExpected = true
    expect((await sendEvent(messageEvent(sourceId, 'message.hard_bounced'))).status).toBe(200)

    vi.unstubAllEnvs()
    vi.stubEnv('CI', 'false')
    const req = await createLocalReq({}, payload)
    const reference = randomUUID()
    references.push(reference)
    const { operationId } = await bindTransactionalEmail(req, catalog).accept({
      type: 'clinic.registration-received',
      operationReference: reference,
      registrationId: syntheticRegistrationId,
    })
    const rotated = createActivationFixture('preview', false, true)
    const currentKey = rotated.binding.recipientDigestKeys[0]!
    const links = { generate: vi.fn() }
    const transport = vi.fn()

    await createTransactionalEmailWorker(req, {
      catalog,
      now: () => webhookNow,
      links,
      httpTransport: transport,
      providerBinding: rotated.binding,
      activationPolicy: resolveActivationPolicy(rotated.binding, rotated.registry, [
        recipientAddressDigest(recipientAddress, currentKey)!,
      ]),
    }).run(operationId)

    expect(links.generate).not.toHaveBeenCalled()
    expect(transport).not.toHaveBeenCalled()
    expect((await stored(operationId)).state).toBe('suppressed')
    const digests = rotated.binding.recipientDigestKeys.map((key) => recipientAddressDigest(recipientAddress, key)!)
    const versions = rotated.binding.recipientDigestKeys.map(({ version }) => version).sort()
    const { rows } = await observer.query(
      `SELECT split_part(recipient_digest, ':', 1) AS version,
              reason,
              source,
              first_observed_at,
              last_observed_at
        FROM transactional_email_suppressions
        WHERE runtime_environment = 'preview'
          AND recipient_digest = ANY($1::text[])
        ORDER BY version`,
      [digests],
    )
    expect(rows).toEqual(
      versions.map((version) => ({
        version,
        reason: 'hard-bounce',
        source: 'lettermint',
        first_observed_at: new Date(webhookTestEvent().timestamp),
        last_observed_at: new Date(webhookTestEvent().timestamp),
      })),
    )
  })

  it('converges concurrent previous-version matches on one current suppression before either delivery proceeds', async () => {
    const sourceId = await preparedOperation()
    mutationExpected = true
    expect((await sendEvent(messageEvent(sourceId, 'message.hard_bounced'))).status).toBe(200)

    vi.unstubAllEnvs()
    vi.stubEnv('CI', 'false')
    const rotated = createActivationFixture('preview', false, true)
    const currentKey = rotated.binding.recipientDigestKeys[0]!
    const allowlist = [recipientAddressDigest(recipientAddress, currentKey)!]
    const currentDigest = allowlist[0]!
    const queued = async () => {
      const req = await createLocalReq({}, payload)
      const reference = randomUUID()
      references.push(reference)
      const receipt = await bindTransactionalEmail(req, catalog).accept({
        type: 'clinic.registration-received',
        operationReference: reference,
        registrationId: syntheticRegistrationId,
      })
      return { req, operationId: receipt.operationId }
    }
    const [firstOperation, secondOperation] = await Promise.all([queued(), queued()])
    const links = { generate: vi.fn() }
    const transport = vi.fn()
    const begin = payload.db.beginTransaction.bind(payload.db)
    const attempts = vi
      .spyOn(payload.db, 'beginTransaction')
      .mockImplementation((options) => begin({ ...options, isolationLevel: 'read committed' }))
    const hooks = payload.collections.transactionalEmailSuppressions.config.hooks.beforeChange
    const arrivals = [signal(), signal()]
    const releases = [signal(), signal()]
    let creates = 0
    const hook: (typeof hooks)[number] = async ({ data, operation }) => {
      if (operation === 'create' && String(data.recipientDigest).startsWith(`${currentKey.version}:`)) {
        const index = creates++
        arrivals[index]!.resolve()
        await releases[index]!.promise
      }
      return data
    }
    hooks.push(hook)
    const close = registerRaceCleanup(() => {
      releases.forEach((release) => release.resolve())
      hooks.splice(hooks.indexOf(hook), 1)
    })
    const run = ({ req, operationId }: Awaited<ReturnType<typeof queued>>) =>
      createTransactionalEmailWorker(req, {
        catalog,
        links,
        httpTransport: transport,
        providerBinding: rotated.binding,
        activationPolicy: resolveActivationPolicy(rotated.binding, rotated.registry, allowlist),
      }).run(operationId)
    const first = trackRaceWork(run(firstOperation))
    let second: Promise<void> | undefined
    try {
      await reachBarrier(arrivals[0]!.promise, first)
      second = trackRaceWork(run(secondOperation))
      await reachBarrier(arrivals[1]!.promise, second)
      expect(
        (
          await observer.query(
            "SELECT count(*)::int AS count FROM transactional_email_suppressions WHERE runtime_environment = 'preview' AND recipient_digest = $1",
            [currentDigest],
          )
        ).rows[0].count,
      ).toBe(0)
      releases[0]!.resolve()
      await first
      releases[1]!.resolve()
      await second
      expect(links.generate).not.toHaveBeenCalled()
      expect(transport).not.toHaveBeenCalled()
      expect((await stored(firstOperation.operationId)).state).toBe('suppressed')
      expect((await stored(secondOperation.operationId)).state).toBe('suppressed')
      expect(
        (
          await observer.query(
            "SELECT count(*)::int AS count FROM transactional_email_suppressions WHERE runtime_environment = 'preview' AND recipient_digest = $1",
            [currentDigest],
          )
        ).rows[0].count,
      ).toBe(1)
      expect(attempts.mock.calls.length).toBeGreaterThan(2)
    } finally {
      close()
      await Promise.all([first, second])
      attempts.mockRestore()
    }
  })

  it('rolls back current-version materialization when its transaction fails', async () => {
    const sourceId = await preparedOperation()
    mutationExpected = true
    expect((await sendEvent(messageEvent(sourceId, 'message.hard_bounced'))).status).toBe(200)

    vi.unstubAllEnvs()
    vi.stubEnv('CI', 'false')
    const req = await createLocalReq({}, payload)
    const reference = randomUUID()
    references.push(reference)
    const { operationId } = await bindTransactionalEmail(req, catalog).accept({
      type: 'clinic.registration-received',
      operationReference: reference,
      registrationId: syntheticRegistrationId,
    })
    const rotated = createActivationFixture('preview', false, true)
    const currentKey = rotated.binding.recipientDigestKeys[0]!
    const currentDigest = recipientAddressDigest(recipientAddress, currentKey)!
    const links = { generate: vi.fn() }
    const transport = vi.fn()
    const hooks = payload.collections.transactionalEmailSuppressions.config.hooks.afterChange ?? []
    payload.collections.transactionalEmailSuppressions.config.hooks.afterChange = hooks
    const failure: (typeof hooks)[number] = async ({ doc, operation }) => {
      if (operation === 'create' && String(doc.recipientDigest).startsWith(`${currentKey.version}:`))
        throw new Error('Synthetic private materialization failure')
      return doc
    }
    hooks.push(failure)
    try {
      await createTransactionalEmailWorker(req, {
        catalog,
        links,
        httpTransport: transport,
        providerBinding: rotated.binding,
        activationPolicy: resolveActivationPolicy(rotated.binding, rotated.registry, [currentDigest]),
      }).run(operationId)
    } finally {
      hooks.splice(hooks.indexOf(failure), 1)
    }

    expect(links.generate).not.toHaveBeenCalled()
    expect(transport).not.toHaveBeenCalled()
    expect(await stored(operationId)).toMatchObject({ state: 'queued', attempt_count: '0' })
    expect(
      (
        await observer.query(
          "SELECT count(*)::int AS count FROM transactional_email_suppressions WHERE runtime_environment = 'preview' AND recipient_digest = $1",
          [currentDigest],
        )
      ).rows[0].count,
    ).toBe(0)
    expect(JSON.stringify([logCalls, signalCalls, requestErrors])).not.toContain('materialization failure')
  })

  it.each(['outbox', 'suppression', 'allowlist'] as const)(
    'blocks the supported retirement workflow when only %s still references the previous version',
    async (source) => {
      mutationExpected = true
      const version = `retire-${source}-${randomUUID()}`
      const rotated = createActivationFixture('preview', false, true, version)
      Object.assign(webhookConfiguration.registry, rotated.configuration.registry)
      Object.assign(webhookConfiguration.secrets, rotated.configuration.secrets)
      for (const [key, value] of Object.entries(rotated.configuration.secrets.preview)) vi.stubEnv(key, value)
      vi.stubEnv('LETTERMINT_PREVIEW_RECIPIENT_DIGESTS', undefined)
      const previous = rotated.binding.recipientDigestKeys.find((key) => key.version === version)!
      const digest = recipientAddressDigest(recipientAddress, previous)!
      if (source === 'outbox') {
        const operationId = await preparedOperation()
        await observer.query('UPDATE transactional_email_outbox SET provider_recipient_digest = $1 WHERE id = $2', [
          digest,
          operationId,
        ])
      } else if (source === 'suppression') {
        const observedAt = new Date(webhookNow).toISOString()
        await observer.query(
          `INSERT INTO transactional_email_suppressions
            (runtime_environment, recipient_digest, reason, first_observed_at, last_observed_at, source, created_at, updated_at)
           VALUES ('preview', $1, 'hard-bounce', $2, $2, 'lettermint', $2, $2)`,
          [digest, observedAt],
        )
      } else vi.stubEnv('LETTERMINT_PREVIEW_RECIPIENT_DIGESTS', JSON.stringify([digest]))
      const req = await createLocalReq({}, payload)
      const retireConfiguration = vi.fn()
      try {
        let failure: unknown
        try {
          await retireDigestKey(req, 'preview', version, retireConfiguration)
        } catch (error) {
          failure = error
        }
        expect(failure).toBeInstanceOf(Error)
        expect(JSON.parse(JSON.stringify(failure))).toEqual({
          code: 'digest-key-retirement-blocked',
          evidence: {
            environment: 'preview',
            version,
            outboxRecords: source === 'outbox' ? 1 : 0,
            suppressionRecords: source === 'suppression' ? 1 : 0,
            previewAllowlistEntries: source === 'allowlist' ? 1 : 0,
          },
          name: 'DigestKeyRetirementBlockedError',
        })
        expect(retireConfiguration).not.toHaveBeenCalled()
        const visible = JSON.stringify([failure, logCalls, signalCalls, requestErrors])
        for (const sentinel of [
          recipientAddress,
          digest,
          previous.secret,
          rotated.binding.digestKey,
          rotated.binding.projectToken,
          rotated.binding.target.projectId,
          'synthetic-message',
        ])
          expect(visible).not.toContain(sentinel)
      } finally {
        await observer.query(
          "DELETE FROM transactional_email_suppressions WHERE runtime_environment = 'preview' AND recipient_digest = $1",
          [digest],
        )
      }
    },
  )

  it('retires only an explicitly configured previous version after a zero-reference proof', async () => {
    mutationExpected = true
    const version = `retire-production-${randomUUID()}`
    const rotated = createActivationFixture('production', false, true, version)
    Object.assign(webhookConfiguration.registry, rotated.configuration.registry)
    Object.assign(webhookConfiguration.secrets, rotated.configuration.secrets)
    for (const [key, value] of Object.entries(rotated.configuration.secrets.production)) vi.stubEnv(key, value)
    vi.stubEnv('LETTERMINT_PREVIEW_RECIPIENT_DIGESTS', undefined)
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    const req = await createLocalReq({}, payload)
    const retireConfiguration = vi.fn()

    await expect(retireDigestKey(req, 'production', version, retireConfiguration)).resolves.toEqual({
      environment: 'production',
      version,
      outboxRecords: 0,
      suppressionRecords: 0,
      previewAllowlistEntries: 0,
    })
    expect(retireConfiguration).toHaveBeenCalledOnce()
    expect(retireConfiguration).toHaveBeenCalledWith({
      environment: 'production',
      version,
      fingerprint: rotated.binding.credentialEvidence.previousDigestKeys.find(
        (fingerprint) => fingerprint.version === version,
      ),
    })

    const currentVersion = rotated.binding.recipientDigestKeys[0]!.version
    await expect(retireDigestKey(req, 'production', currentVersion, retireConfiguration)).rejects.toMatchObject({
      code: 'environment-unavailable',
    })
    await expect(retireDigestKey(req, 'production', 'unknown-version', retireConfiguration)).rejects.toMatchObject({
      code: 'environment-unavailable',
    })
    expect(retireConfiguration).toHaveBeenCalledOnce()
  })

  it('runs the real retirement command and proves the reviewed follow-up configuration starts', async () => {
    const version = `retire-command-${randomUUID()}`
    const rotated = createActivationFixture('production', false, true, version)
    Object.assign(webhookConfiguration.registry, rotated.configuration.registry)
    Object.assign(webhookConfiguration.secrets, rotated.configuration.secrets)
    for (const [key, value] of Object.entries(rotated.configuration.secrets.production)) vi.stubEnv(key, value)
    vi.stubEnv('LETTERMINT_PREVIEW_RECIPIENT_DIGESTS', undefined)
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('DEPLOYMENT_ENV', 'production')
    const directory = await mkdtemp(join(tmpdir(), 'lettermint-retirement-command-'))
    const path = join(directory, 'registry.json')
    await writeFile(path, `${JSON.stringify(rotated.configuration.registry, null, 2)}\n`)
    let output = ''
    try {
      await runDigestKeyRetirement(['--environment', 'production', '--version', version], {
        open: async () => ({
          req: await createLocalReq({}, payload),
          close: async () => {},
        }),
        registryPath: path,
        write: (value) => {
          output += value
        },
      })
      expect(output).toBe(
        `Digest key fingerprint removed: environment=production version=${version} outbox=0 suppressions=0 previewAllowlist=0. Remove the matching previous secret and approve the updated activation preflight before deployment.\n`,
      )
      const retiredRegistry = JSON.parse(await readFile(path, 'utf8'))
      expect(
        retiredRegistry.fingerprints.some(
          (entry: { environment: string; digestKeyId?: string }) =>
            entry.environment === 'production' && entry.digestKeyId === version,
        ),
      ).toBe(false)
      const retiredEnv = {
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
        DEPLOYMENT_ENV: 'production',
        ...rotated.configuration.secrets.production,
        LETTERMINT_PREVIOUS_RECIPIENT_DIGEST_KEYS: undefined,
      }
      expect(() =>
        validateTransactionalEmailStartup(
          retiredEnv,
          retiredRegistry,
          rotated.configuration.locks,
          webhookNow,
          rotated.registry,
        ),
      ).toThrow('environment-unavailable')
      const approvedActivation = structuredClone(rotated.registry)
      approvedActivation.preflights[0]!.credentials.previousDigestKeys = []
      expect(
        validateTransactionalEmailStartup(
          retiredEnv,
          retiredRegistry,
          rotated.configuration.locks,
          webhookNow,
          approvedActivation,
        ),
      ).toEqual({ environment: 'production' })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it.each(['message.hard_bounced', 'message.spam_complaint'])(
    'retries native suppression uniqueness with %s committing first and retains complaint',
    async (firstType) => {
      const firstId = await preparedOperation()
      const secondId = await preparedOperation()
      const firstEvent = messageEvent(firstId, firstType)
      const secondEvent = messageEvent(
        secondId,
        firstType === 'message.hard_bounced' ? 'message.spam_complaint' : 'message.hard_bounced',
      )
      const begin = payload.db.beginTransaction.bind(payload.db)
      const attempts = vi
        .spyOn(payload.db, 'beginTransaction')
        .mockImplementation((options) => begin({ ...options, isolationLevel: 'read committed' }))
      const hooks = payload.collections.transactionalEmailSuppressions.config.hooks.beforeChange
      const arrivals = [signal(), signal()]
      const releases = [signal(), signal()]
      let inserts = 0
      const hook: (typeof hooks)[number] = async ({ data, operation }) => {
        if (operation === 'create') {
          const index = inserts++
          arrivals[index]!.resolve()
          await releases[index]!.promise
        }
        return data
      }
      hooks.push(hook)
      const close = registerRaceCleanup(() => {
        releases.forEach((release) => release.resolve())
        hooks.splice(hooks.indexOf(hook), 1)
      })
      const first = trackRaceWork(sendEvent(firstEvent))
      let second: ReturnType<typeof sendEvent> | undefined
      mutationExpected = true
      try {
        await reachBarrier(arrivals[0]!.promise, first)
        second = trackRaceWork(sendEvent(secondEvent))
        await reachBarrier(arrivals[1]!.promise, second)
        expect(await state()).toEqual(beforeState)
        releases[0]!.resolve()
        expect((await first).status).toBe(200)
        releases[1]!.resolve()
        expect((await second).status).toBe(200)
        expect(attempts).toHaveBeenCalledTimes(3)
        expect((await suppressionsFor(firstId)).map((entry) => entry.reason)).toEqual(['spam-complaint'])
        for (const id of [firstId, secondId])
          expect((await history(id)).filter((entry) => entry.provider_event_id)).toHaveLength(1)
      } finally {
        close()
        await Promise.all([first, second])
        attempts.mockRestore()
      }
    },
  )

  it('isolates suppression lookups and writes between Preview and Production for the same recipient', async () => {
    const previewId = await preparedOperation()
    mutationExpected = true
    expect((await sendEvent(messageEvent(previewId, 'message.spam_complaint'))).status).toBe(200)
    const productionId = await preparedOperation('production')
    expect((await stored(productionId)).attempt_count).toBe('1')
    const event = {
      ...messageEvent(productionId, 'message.hard_bounced'),
      context: webhookTestEvent('production').context,
    }
    event.data.metadata.environment = 'production'
    expect(
      (
        await send({
          environment: 'production',
          body: JSON.stringify(event),
          secret: webhookConfiguration.secrets.production.LETTERMINT_WEBHOOK_SECRET!,
          headers: { 'x-lettermint-event': event.event },
        })
      ).status,
    ).toBe(200)
    expect(
      (await suppressionsFor(previewId)).map(({ runtime_environment, reason }) => [runtime_environment, reason]),
    ).toEqual([['preview', 'spam-complaint']])
    expect(
      (await suppressionsFor(productionId)).map(({ runtime_environment, reason }) => [runtime_environment, reason]),
    ).toEqual([['production', 'hard-bounce']])
  })

  it.each(['queued', 'prepared', 'unavailable'])(
    'withholds the next preparation or provider attempt when suppression is %s',
    async (scenario) => {
      const sourceId = await preparedOperation()
      const retryId = scenario === 'prepared' ? await preparedOperation() : null
      mutationExpected = true
      if (scenario !== 'unavailable')
        expect((await sendEvent(messageEvent(sourceId, 'message.hard_bounced'))).status).toBe(200)
      vi.unstubAllEnvs()
      vi.stubEnv('CI', 'false')
      const req = await createLocalReq({}, payload)
      let operationId = retryId
      if (!operationId) {
        const reference = randomUUID()
        references.push(reference)
        operationId = (
          await bindTransactionalEmail(req, catalog).accept({
            type: 'clinic.registration-received',
            operationReference: reference,
            registrationId: syntheticRegistrationId,
          })
        ).operationId
      } else
        await observer.query("UPDATE transactional_email_outbox SET runtime_environment = 'test' WHERE id = $1", [
          operationId,
        ])
      const fixture = createActivationFixture()
      const generate = vi.fn(async () => {
        throw new Error('Unexpected auth generation')
      })
      const transport = vi.fn(async () => {
        throw new Error('Unexpected transport')
      })
      const hooks = payload.collections.transactionalEmailSuppressions.config.hooks.beforeOperation
      const failure: (typeof hooks)[number] = () => {
        throw new Error('private-unavailable-detail')
      }
      if (scenario === 'unavailable') hooks.push(failure)
      const workerSignalOffset = signalCalls.length
      try {
        await createTransactionalEmailWorker(req, {
          catalog,
          now: () => webhookNow + 61_000,
          links: { generate },
          httpTransport: transport,
          providerBinding: fixture.binding,
          activationPolicy: resolveActivationPolicy(fixture.binding, fixture.registry, [
            recipientAddressDigest(recipientAddress, {
              version: fixture.binding.target.digestKeyId,
              secret: fixture.binding.digestKey,
            })!,
          ]),
          log: (event) => signalCalls.push(event),
        }).run(operationId)
      } finally {
        if (scenario === 'unavailable') hooks.splice(hooks.indexOf(failure), 1)
      }
      expect(generate).not.toHaveBeenCalled()
      expect(transport).not.toHaveBeenCalled()
      expect(await stored(operationId)).toMatchObject({
        state: scenario === 'unavailable' ? 'queued' : 'suppressed',
        attempt_count: scenario === 'prepared' ? '1' : '0',
      })
      expect(signalCalls.slice(workerSignalOffset)).toEqual([
        {
          operationId,
          commandType: 'clinic.registration-received',
          environment: 'test',
          outcomeCode: scenario === 'unavailable' ? 'suppression-unavailable' : 'suppression-hit',
          outboxState: scenario === 'unavailable' ? 'queued' : 'suppressed',
          ...(scenario === 'prepared' ? { attemptNumber: 1 } : {}),
        },
      ])
      expect(JSON.stringify([logCalls, signalCalls, requestErrors]).includes('private-unavailable-detail')).toBe(false)
    },
  )

  function signal() {
    let resolve!: () => void
    const promise = new Promise<void>((done) => {
      resolve = done
    })
    return { promise, resolve }
  }

  function trackRaceWork<Result>(work: Promise<Result>): Promise<Result> {
    raceWork.add(work)
    // The test awaits the original promise; this handler also covers rejection before its barrier wait starts.
    void work.catch(() => {})
    return work
  }

  function registerRaceCleanup(cleanup: () => void) {
    const close = () => {
      if (raceCleanup.delete(close)) cleanup()
    }
    raceCleanup.add(close)
    return close
  }

  async function reachBarrier(ready: Promise<void>, participant: Promise<unknown>) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        ready,
        participant.then(() => {
          throw new Error('Race participant completed before the expected barrier')
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Race barrier was not reached within six seconds')), 6000)
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
  }

  async function inFlightOperation(messageId = 'synthetic-message', status = 202) {
    vi.unstubAllEnvs()
    vi.stubEnv('CI', 'false')
    const req = await createLocalReq({}, payload)
    const reference = randomUUID()
    references.push(reference)
    const { operationId } = await bindTransactionalEmail(req, catalog).accept({
      type: 'clinic.registration-received',
      operationReference: reference,
      registrationId: syntheticRegistrationId,
    })
    const fixture = createActivationFixture('preview')
    const received = signal()
    const release = signal()
    const resume = registerRaceCleanup(release.resolve)
    const completion = trackRaceWork(
      createTransactionalEmailWorker(req, {
        catalog,
        now: () => webhookNow,
        suppression: async () => 'cleared',
        providerBinding: fixture.binding,
        activationPolicy: resolveActivationPolicy(fixture.binding, fixture.registry, [
          recipientAddressDigest(recipientAddress, {
            version: fixture.binding.target.digestKeyId,
            secret: fixture.binding.digestKey,
          })!,
        ]),
        httpTransport: async () => {
          received.resolve()
          await release.promise
          return new Response(JSON.stringify({ message_id: messageId, status: 'pending' }), { status })
        },
        log: (event) => signalCalls.push(event),
      }).run(operationId),
    )
    await reachBarrier(received.promise, completion)
    // The test worker prepares real provider bytes without activating a hosted runtime.
    await observer.query('UPDATE transactional_email_outbox SET runtime_environment = $1 WHERE id = $2', [
      'preview',
      operationId,
    ])
    for (const [key, value] of Object.entries(webhookConfiguration.secrets.preview)) vi.stubEnv(key, value)
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    beforeState = await state()
    return { operationId, resume, completion }
  }

  it('signals a conflicting worker provider reference after a webhook wins without changing durable state', async () => {
    const worker = await inFlightOperation('conflicting-message')
    mutationExpected = true
    try {
      expect((await sendEvent(messageEvent(worker.operationId, 'message.delivered'))).status).toBe(200)
      const committed = await state()
      worker.resume()
      await worker.completion
      expect(await state()).toEqual(committed)
      expect(signalCalls.map((signal) => validateDeliveryEdgeLog(signal).outcomeCode)).toContain(
        'provider-event-mismatch',
      )
      expectedSignals.push({ outcomeCode: 'provider-event-mismatch' })
    } finally {
      worker.resume()
      await worker.completion
    }
  })

  it.each(['message.created', 'message.delivered', 'message.hard_bounced', 'message.spam_complaint'])(
    'preserves %s when the synchronous worker result arrives after the webhook',
    async (type) => {
      const worker = await inFlightOperation()
      mutationExpected = true
      try {
        const event = messageEvent(worker.operationId, type)
        expect((await sendEvent(event)).status).toBe(200)
        const committed = await state()
        worker.resume()
        await worker.completion
        expect(await state()).toEqual(committed)
        const events = await history(worker.operationId)
        expect(events.filter((entry) => entry.type === 'delivery.accepted')).toHaveLength(1)
        expect(events.filter((entry) => entry.type === 'payload.scrubbed')).toHaveLength(1)
        expect((await stored(worker.operationId)).provider_message_id).toBe('synthetic-message')
        expect(await (await sendEvent(event)).json()).toEqual({ outcomeCode: 'provider-event-duplicate' })
        expect(await state()).toEqual(committed)
      } finally {
        worker.resume()
        await worker.completion
      }
    },
  )

  it('applies delivery after a committed worker acceptance without another acceptance or scrub event', async () => {
    const worker = await inFlightOperation()
    worker.resume()
    await worker.completion
    mutationExpected = true
    const before = await stored(worker.operationId)
    expect(before.state).toBe('accepted')
    expect((await sendEvent(messageEvent(worker.operationId, 'message.delivered'))).status).toBe(200)
    const after = await stored(worker.operationId)
    expect(after.state).toBe('delivered')
    for (const field of ['provider_message_id', 'provider_accepted_at', 'terminal_at', 'scrubbed_at'])
      expect(after[field]).toEqual(before[field])
    const events = await history(worker.operationId)
    expect(events.filter((entry) => entry.type === 'delivery.accepted')).toHaveLength(1)
    expect(events.filter((entry) => entry.type === 'payload.scrubbed')).toHaveLength(1)
  })

  it.each([200, 503, 422])(
    'preserves webhook delivery after an ambiguous, retryable, or permanent HTTP %i worker result',
    async (status) => {
      const worker = await inFlightOperation('synthetic-message', status)
      mutationExpected = true
      try {
        expect((await sendEvent(messageEvent(worker.operationId, 'message.delivered'))).status).toBe(200)
        const committed = await state()
        const workerSignalOffset = signalCalls.length
        worker.resume()
        await worker.completion
        expect(await state()).toEqual(committed)
        expect(signalCalls.slice(workerSignalOffset)).toEqual([
          {
            operationId: worker.operationId,
            commandType: 'clinic.registration-received',
            attemptNumber: 1,
            outcomeCode:
              status === 422
                ? 'provider-request-rejected'
                : status === 503
                  ? 'provider-temporary'
                  : 'provider-ambiguous',
            environment: 'test',
            outboxState: 'delivered',
            durationBucket: 'lt-1s',
            queueAgeBucket: 'lt-1m',
          },
        ])
      } finally {
        worker.resume()
        await worker.completion
      }
    },
  )

  it.each(['type', 'timestamp', 'operation', 'message'])(
    'acknowledges conflicting replay of the same provider event ID with changed %s without mutation',
    async (field) => {
      const id = await preparedOperation()
      const otherId = field === 'operation' ? await preparedOperation() : id
      const event = messageEvent(id, 'message.delivered')
      mutationExpected = true
      expect((await sendEvent(event)).status).toBe(200)
      const committed = await state()
      if (field === 'type') event.event = 'message.spam_complaint'
      if (field === 'timestamp') event.timestamp = '2020-01-01T00:00:00.000Z'
      if (field === 'operation') event.data.metadata.operation_id = otherId
      if (field === 'message') event.data.message_id = 'conflicting-message'
      expectedSignals.push({ outcomeCode: 'provider-event-mismatch' })
      const response = await sendEvent(event)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ outcomeCode: 'provider-event-mismatch' })
      expect(await state()).toEqual(committed)
    },
  )

  function pauseFirstTwoReads(id: string) {
    const hooks = payload.collections.transactionalEmailOutbox.config.hooks.afterRead
    const reads = [signal(), signal()]
    const releases = [signal(), signal()]
    const transactions = new Set<number | string>()
    const hook: (typeof hooks)[number] = async ({ doc, req }) => {
      const transactionID = await req.transactionID
      if (String(doc.id) === id && transactionID && !transactions.has(transactionID)) {
        transactions.add(transactionID)
        const index = transactions.size - 1
        if (index < 2) {
          reads[index]!.resolve()
          await releases[index]!.promise
        }
      }
      return doc
    }
    hooks.push(hook)
    const close = registerRaceCleanup(() => {
      releases.forEach((release) => release.resolve())
      hooks.splice(hooks.indexOf(hook), 1)
    })
    return {
      reads,
      releases,
      transactions,
      close,
    }
  }

  it.each(['webhook', 'worker'])(
    'retries an overlapping worker result and webhook transaction when the %s commits first',
    async (winner) => {
      const worker = await inFlightOperation()
      const id = worker.operationId
      const coordination = pauseFirstTwoReads(id)
      let webhook: ReturnType<typeof sendEvent> | undefined
      mutationExpected = true
      try {
        // The first read is reached only after the controlled HTTP acceptance was parsed.
        worker.resume()
        await reachBarrier(coordination.reads[0]!.promise, worker.completion)
        webhook = trackRaceWork(sendEvent(messageEvent(id, 'message.delivered')))
        await reachBarrier(coordination.reads[1]!.promise, webhook)
        expect(await state()).toEqual(beforeState)
        if (winner === 'webhook') {
          coordination.releases[1]!.resolve()
          expect((await webhook).status).toBe(200)
          const committed = await state()
          coordination.releases[0]!.resolve()
          await worker.completion
          expect(await state()).toEqual(committed)
        } else {
          coordination.releases[0]!.resolve()
          await worker.completion
          expect((await stored(id)).state).toBe('accepted')
          coordination.releases[1]!.resolve()
          expect((await webhook).status).toBe(200)
        }
        expect(coordination.transactions.size).toBe(3)
        const events = await history(id)
        expect(events.filter((entry) => entry.type === 'delivery.accepted')).toEqual([
          expect.objectContaining({ source: winner === 'webhook' ? 'provider' : 'worker' }),
        ])
        expect(events.filter((entry) => entry.type === 'payload.scrubbed')).toHaveLength(1)
        expect(events.map((entry) => entry.sequence)).toEqual(
          Array.from({ length: events.length }, (_, index) => index + 1),
        )
        expect(await stored(id)).toMatchObject({
          state: 'delivered',
          provider_message_id: 'synthetic-message',
          latest_event_sequence: events.length,
        })
      } finally {
        coordination.close()
        worker.resume()
        await Promise.all([worker.completion, webhook])
      }
    },
  )

  it('rolls back a native provider-ID unique conflict and retries the entire event transaction', async () => {
    const firstId = await preparedOperation()
    const secondId = await preparedOperation()
    const beforeSecond = await stored(secondId)
    const beforeHistory = await history(secondId)
    const firstEvent = messageEvent(firstId, 'message.delivered')
    const secondEvent = { ...messageEvent(secondId, 'message.spam_complaint'), id: firstEvent.id }
    // READ COMMITTED isolates native unique-constraint translation from SERIALIZABLE's earlier conflict.
    const begin = payload.db.beginTransaction.bind(payload.db)
    const attempts = vi
      .spyOn(payload.db, 'beginTransaction')
      .mockImplementation((options) => begin({ ...options, isolationLevel: 'read committed' }))
    const hooks = payload.collections.transactionalEmailEvents.config.hooks.beforeChange
    const arrivals = [signal(), signal()]
    const releases = [signal(), signal()]
    let inserts = 0
    const hook: (typeof hooks)[number] = async ({ data }) => {
      if (data.providerEventId === firstEvent.id) {
        const index = inserts++
        arrivals[index]!.resolve()
        await releases[index]!.promise
      }
      return data
    }
    hooks.push(hook)
    const close = registerRaceCleanup(() => {
      releases.forEach((release) => release.resolve())
      hooks.splice(hooks.indexOf(hook), 1)
    })
    const first = trackRaceWork(sendEvent(firstEvent))
    let second: ReturnType<typeof sendEvent> | undefined
    mutationExpected = true
    expectedSignals.push({ outcomeCode: 'provider-event-mismatch' })
    try {
      await reachBarrier(arrivals[0]!.promise, first)
      second = trackRaceWork(sendEvent(secondEvent))
      await reachBarrier(arrivals[1]!.promise, second)
      expect(await state()).toEqual(beforeState)
      releases[0]!.resolve()
      expect((await first).status).toBe(200)
      releases[1]!.resolve()
      expect(await (await second).json()).toEqual({ outcomeCode: 'provider-event-mismatch' })
      expect(attempts).toHaveBeenCalledTimes(3)
      expect(inserts).toBe(2)
      expect(await stored(secondId)).toEqual(beforeSecond)
      expect(await history(secondId)).toEqual(beforeHistory)
      expect((await history(firstId)).filter((entry) => entry.provider_event_id === firstEvent.id)).toHaveLength(1)
    } finally {
      close()
      await Promise.all([first, second])
      attempts.mockRestore()
    }
    const committed = await state()
    expect(await (await sendEvent(firstEvent)).json()).toEqual({ outcomeCode: 'provider-event-duplicate' })
    expect(await state()).toEqual(committed)
  })

  it.each([2, 3])(
    'retries complete event transactions after %i real COMMIT serialization failures',
    async (failures) => {
      const id = await preparedOperation()
      const event = messageEvent(id, 'message.delivered')
      const beforeEvents = await history(id)
      await observer.query('CREATE SEQUENCE webhook_commit_attempt')
      await observer.query(`CREATE FUNCTION webhook_commit_conflict() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.provider_event_id IS NOT NULL AND nextval('webhook_commit_attempt') <= ${failures} THEN
          RAISE EXCEPTION 'synthetic-private-commit-conflict' USING ERRCODE = '40001';
        END IF;
        RETURN NEW;
      END $$`)
      await observer.query(`CREATE CONSTRAINT TRIGGER webhook_commit_conflict
      AFTER INSERT ON transactional_email_events DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION webhook_commit_conflict()`)
      const hooks = payload.collections.transactionalEmailEvents.config.hooks.afterChange
      let uncommittedAttempts = 0
      const hook: (typeof hooks)[number] = async ({ doc }) => {
        if (doc.providerEventId === event.id) {
          uncommittedAttempts++
          expect(await state()).toEqual(beforeState)
        }
        return doc
      }
      hooks.push(hook)
      mutationExpected = true
      try {
        const response = await sendEvent(event)
        expect(response.status).toBe(failures === 2 ? 200 : 503)
        expect(await response.json()).toEqual({
          outcomeCode: failures === 2 ? 'provider-event-applied' : 'webhook-unavailable',
        })
        expect(uncommittedAttempts).toBe(3)
        expect((await observer.query('SELECT last_value::int FROM webhook_commit_attempt')).rows[0].last_value).toBe(3)
        if (failures === 3) expect(await state()).toEqual(beforeState)
      } finally {
        hooks.splice(hooks.indexOf(hook), 1)
        await observer.query('DROP TRIGGER webhook_commit_conflict ON transactional_email_events')
        await observer.query('DROP FUNCTION webhook_commit_conflict()')
        await observer.query('DROP SEQUENCE webhook_commit_attempt')
      }
      const retry = await sendEvent(event)
      expect(retry.status).toBe(200)
      expect(await retry.json()).toEqual({
        outcomeCode: failures === 2 ? 'provider-event-duplicate' : 'provider-event-applied',
      })
      const events = await history(id)
      expect(events).toHaveLength(beforeEvents.length + 3)
      expect(events.map((entry) => entry.sequence)).toEqual(
        Array.from({ length: events.length }, (_, index) => index + 1),
      )
      expect(events.filter((entry) => entry.provider_event_id === event.id)).toHaveLength(1)
      expect(await stored(id)).toMatchObject({
        state: 'delivered',
        provider_message_id: 'synthetic-message',
        latest_event_sequence: events.length,
      })
      const committed = await state()
      expect(await (await sendEvent(event)).json()).toEqual({ outcomeCode: 'provider-event-duplicate' })
      expect(await state()).toEqual(committed)
    },
  )

  it.each([
    ['message.delivered', 'message.spam_complaint', 'delivered'],
    ['message.spam_complaint', 'message.delivered', 'complained'],
    ['message.hard_bounced', 'message.spam_complaint', 'bounced'],
    ['message.spam_complaint', 'message.hard_bounced', 'complained'],
    ['message.created', 'message.sent', 'accepted'],
    ['message.suppressed', 'message.delivered', 'failed'],
    ['message.delivered', 'message.policy_rejected', 'delivered'],
    ['message.delivered', 'identical-replay', 'delivered'],
    ['message.delivered', 'conflicting-replay', 'delivered'],
    ['message.delivered', 'conflicting-message', 'delivered'],
  ])(
    'serializes overlapping %s and %s with complete retries and retains %s',
    async (firstType, secondType, stateName) => {
      const id = await preparedOperation()
      const firstEvent = messageEvent(id, firstType)
      const secondEvent = secondType === 'identical-replay' ? firstEvent : messageEvent(id, secondType)
      if (secondType === 'conflicting-replay') {
        secondEvent.id = firstEvent.id
        secondEvent.event = 'message.spam_complaint'
      }
      if (secondType === 'conflicting-message') {
        secondEvent.event = 'message.delivered'
        secondEvent.data.message_id = 'conflicting-message'
      }
      const ignored = ['identical-replay', 'conflicting-replay', 'conflicting-message'].includes(secondType)
      const mismatch = ['conflicting-replay', 'conflicting-message'].includes(secondType)
      if (mismatch) expectedSignals.push({ outcomeCode: 'provider-event-mismatch' })
      const beforeEvents = await history(id)
      const coordination = pauseFirstTwoReads(id)
      const first = trackRaceWork(sendEvent(firstEvent))
      let second: ReturnType<typeof sendEvent> | undefined
      mutationExpected = true
      try {
        await reachBarrier(coordination.reads[0]!.promise, first)
        second = trackRaceWork(sendEvent(secondEvent))
        await reachBarrier(coordination.reads[1]!.promise, second)
        expect(await state()).toEqual(beforeState)
        coordination.releases[0]!.resolve()
        expect((await first).status).toBe(200)
        const firstCommitted = await stored(id)
        coordination.releases[1]!.resolve()
        const response = await second
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
          outcomeCode: mismatch
            ? 'provider-event-mismatch'
            : ignored
              ? 'provider-event-duplicate'
              : 'provider-event-applied',
        })
        expect(coordination.transactions.size).toBe(3)
        const outbox = await stored(id)
        expect(outbox.state).toBe(stateName)
        expect(outbox.provider_message_id).toBe('synthetic-message')
        for (const field of ['provider_accepted_at', 'terminal_at', 'scrubbed_at'])
          expect(outbox[field]).toEqual(firstCommitted[field])
        const events = await history(id)
        expect(events.map((entry) => entry.sequence)).toEqual(
          Array.from({ length: events.length }, (_, index) => index + 1),
        )
        expect(outbox.latest_event_sequence).toBe(events.length)
        expect(events).toHaveLength(beforeEvents.length + (ignored ? 3 : 4))
        expect(events.filter((entry) => entry.provider_event_id === firstEvent.id)).toHaveLength(1)
        if (!ignored)
          expect(events.at(-1)).toMatchObject({ provider_event_id: secondEvent.id, provider_event_type: secondType })
        if ([firstType, !ignored && secondType].includes('message.spam_complaint'))
          expect((await suppressionsFor(id)).map((entry) => entry.reason)).toEqual(['spam-complaint'])
        const committed = await state()
        expect(await (await sendEvent(firstEvent)).json()).toEqual({ outcomeCode: 'provider-event-duplicate' })
        if (!ignored)
          expect(await (await sendEvent(secondEvent)).json()).toEqual({ outcomeCode: 'provider-event-duplicate' })
        expect(await state()).toEqual(committed)
      } finally {
        coordination.close()
        await Promise.all([first, second])
      }
    },
  )

  it('recovers ambiguous provider acceptance from a signed created event and deduplicates its replay', async () => {
    const operationId = await preparedOperation()
    const event = messageEvent(operationId, 'message.created')
    const options = { body: JSON.stringify(event), headers: { 'x-lettermint-event': event.event } }
    const response = await send(options)
    expect(response.status).toBe(200)
    mutationExpected = true
    expect(await response.json()).toEqual({ outcomeCode: 'provider-event-applied' })
    const {
      rows: [outbox],
    } = await observer.query('SELECT * FROM transactional_email_outbox WHERE id = $1', [operationId])
    expect(outbox).toMatchObject({
      state: 'accepted',
      provider_message_id: 'synthetic-message',
      recipient_address: null,
      prepared_provider_request: null,
      next_attempt_at: null,
    })
    const { rows: events } = await observer.query(
      'SELECT type, provider_event_id FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence',
      [operationId],
    )
    expect(events.slice(-3)).toEqual([
      { type: 'delivery.accepted', provider_event_id: null },
      { type: 'payload.scrubbed', provider_event_id: null },
      { type: 'provider.created', provider_event_id: event.id },
    ])
    const committed = await state()
    expect((await send(options)).status).toBe(200)
    expect(await state()).toEqual(committed)
  })

  it.each([
    ['message.sent', 'accepted', 'provider.sent'],
    ['message.delivered', 'delivered', 'delivery.delivered'],
    ['message.hard_bounced', 'bounced', 'delivery.bounced'],
    ['message.soft_bounced', 'accepted', 'provider.soft-bounced'],
    ['message.spam_complaint', 'complained', 'delivery.complained'],
    ['message.failed', 'accepted', 'provider.failed'],
    ['message.suppressed', 'failed', 'provider.suppressed'],
    ['message.policy_rejected', 'failed', 'provider.policy-rejected'],
  ])('maps signed %s to %s with one durable provider result', async (type, expectedState, expectedEvent) => {
    const operationId = await preparedOperation()
    const event = messageEvent(operationId, type)
    mutationExpected = true
    expect((await sendEvent(event)).status).toBe(200)
    const outbox = await stored(operationId)
    expect(outbox.state).toBe(expectedState)
    expect((await suppressionsFor(operationId)).map((entry) => entry.reason)).toEqual(
      type === 'message.hard_bounced' ? ['hard-bounce'] : type === 'message.spam_complaint' ? ['spam-complaint'] : [],
    )
    expect(outbox.provider_message_id).toBe('synthetic-message')
    for (const field of [
      'recipient_address',
      'command_payload',
      'prepared_subject',
      'prepared_html',
      'prepared_text',
      'prepared_provider_request',
      'next_attempt_at',
      'lease_token',
      'lease_expires_at',
    ])
      expect(outbox[field] === null, field).toBe(true)
    const events = await history(operationId)
    expect(events.filter((result) => result.provider_event_id === event.id)).toEqual([
      expect.objectContaining({
        type: expectedEvent,
        source: 'provider',
        provider_event_type: type,
        provider_message_id: 'synthetic-message',
      }),
    ])
    if (expectedState !== 'failed') {
      expect(outbox.provider_accepted_at).toBeInstanceOf(Date)
      expect(events.filter((result) => result.type === 'delivery.accepted')).toHaveLength(1)
    } else {
      expect(outbox.provider_accepted_at).toBeNull()
      expect(events.filter((result) => result.type === 'delivery.failed')).toHaveLength(1)
    }
    const committed = await state()
    expect((await sendEvent(event)).status).toBe(200)
    expect(await state()).toEqual(committed)
  })

  it.each([
    'message.created',
    'message.sent',
    'message.delivered',
    'message.hard_bounced',
    'message.soft_bounced',
    'message.spam_complaint',
    'message.failed',
    'message.suppressed',
    'message.policy_rejected',
  ])('retains established acceptance and retention clocks when %s follows delivery', async (type) => {
    const id = await preparedOperation()
    mutationExpected = true
    expect((await sendEvent(messageEvent(id, 'message.delivered'))).status).toBe(200)
    const before = await stored(id)
    const event = messageEvent(id, type)
    event.timestamp = '2020-01-01T00:00:00.000Z'
    expect((await sendEvent(event)).status).toBe(200)
    const after = await stored(id)
    expect(after.state).toBe('delivered')
    for (const field of ['provider_accepted_at', 'terminal_at', 'scrubbed_at', 'provider_message_id'])
      expect(after[field]).toEqual(before[field])
    expect((await history(id)).filter((entry) => entry.type === 'delivery.accepted')).toHaveLength(1)
    expect((await history(id)).at(-1)?.source_occurred_at).toEqual(new Date(event.timestamp))
    if (type === 'message.spam_complaint')
      expect((await suppressionsFor(id)).map((entry) => entry.reason)).toEqual(['spam-complaint'])
  })

  it.each([
    'operation',
    'oversized-operation',
    'missing-operation',
    'command',
    'environment',
    'message',
    'team',
    'project',
    'route',
  ])('acknowledges a verified %s correlation mismatch without mutation or provider content', async (field) => {
    const id = await preparedOperation()
    const event = messageEvent(id, 'message.created')
    if (field === 'operation') event.data.metadata.operation_id = '2147483647'
    if (field === 'oversized-operation') event.data.metadata.operation_id = '9007199254740991'
    if (field === 'missing-operation') Reflect.deleteProperty(event.data.metadata, 'operation_id')
    if (field === 'command') event.data.metadata.command_type = 'auth.password-recovery'
    if (field === 'environment') event.data.metadata.environment = 'production'
    if (field === 'message')
      await observer.query(
        "UPDATE transactional_email_outbox SET provider_message_id = 'different-message' WHERE id = $1",
        [id],
      )
    if (['team', 'project', 'route'].includes(field)) {
      const column = { team: 'provider_team_id', project: 'provider_project_id', route: 'provider_route_id' }[
        field as 'team' | 'project' | 'route'
      ]
      await observer.query(`UPDATE transactional_email_outbox SET ${column} = $1 WHERE id = $2`, [
        'different-binding',
        id,
      ])
    }
    beforeState = await state()
    const outcomeCode = ['operation', 'oversized-operation', 'missing-operation'].includes(field)
      ? 'provider-event-unmatched'
      : 'provider-event-mismatch'
    expectedSignals.push({ outcomeCode })
    const response = await sendEvent(event)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ outcomeCode })
  })

  it('discards raw fields from signed provider feedback before durable history and logs', async () => {
    const id = await preparedOperation()
    const base = messageEvent(id, 'message.failed')
    const privateValue = 'synthetic-private-provider-content@example.test'
    const event = {
      ...base,
      subject: privateValue,
      context: { ...base.context, privateValue },
      data: {
        ...base.data,
        recipient: privateValue,
        subject: privateValue,
        reason: privateValue,
        reason_code: privateValue,
        response: { content: privateValue },
        tags: [{ name: privateValue, value: privateValue }],
        metadata: { ...base.data.metadata, privateValue },
      },
    }
    mutationExpected = true
    const response = await sendEvent(event)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ outcomeCode: 'provider-event-applied' })
    const events = await history(id)
    expect(events.at(-1)?.type).toBe('provider.failed')
    expect(JSON.stringify([await stored(id), events, logCalls, signalCalls]).includes(privateValue)).toBe(false)
    expect(events.at(-1)?.outcome_code).toBeNull()
    expect(Object.keys(events.at(-1)!).sort()).toEqual(
      [
        'id',
        'outbox_id',
        'sequence',
        'type',
        'source',
        'attempt_number',
        'outcome_code',
        'provider_event_id',
        'provider_event_type',
        'provider_message_id',
        'source_occurred_at',
        'created_at',
        'updated_at',
      ].sort(),
    )
  })

  it.each([
    ['immediate', 'message.delivered'],
    ['commit', 'message.delivered'],
    ['immediate', 'message.spam_complaint'],
    ['commit', 'message.spam_complaint'],
  ])('rolls back a temporary %s storage failure for %s and applies its retry once', async (failure, type) => {
    const id = await preparedOperation()
    const event = messageEvent(id, type)
    await observer.query(`CREATE FUNCTION webhook_result_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.provider_event_id IS NOT NULL THEN RAISE EXCEPTION 'synthetic-private-database-detail'; END IF; RETURN NEW; END $$`)
    try {
      await observer.query(
        failure === 'commit'
          ? 'CREATE CONSTRAINT TRIGGER webhook_result_failure AFTER INSERT ON transactional_email_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION webhook_result_failure()'
          : 'CREATE TRIGGER webhook_result_failure BEFORE INSERT ON transactional_email_events FOR EACH ROW EXECUTE FUNCTION webhook_result_failure()',
      )
      const response = await sendEvent(event)
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ outcomeCode: 'webhook-unavailable' })
      expect(await state()).toEqual(beforeState)
    } finally {
      await observer.query('DROP TRIGGER IF EXISTS webhook_result_failure ON transactional_email_events')
      await observer.query('DROP FUNCTION webhook_result_failure()')
    }
    mutationExpected = true
    expect((await sendEvent(event)).status).toBe(200)
    expect((await stored(id)).state).toBe(type === 'message.delivered' ? 'delivered' : 'complained')
    const committed = await state()
    expect((await sendEvent(event)).status).toBe(200)
    expect(await state()).toEqual(committed)
  })

  it('returns within the total deadline and rolls back a stalled Payload operation when it resumes', async () => {
    const id = await preparedOperation()
    const hooks = payload.collections.transactionalEmailOutbox.config.hooks.afterChange
    let entered!: () => void
    let resume!: () => void
    const ready = new Promise<void>((resolve) => {
      entered = resolve
    })
    const stalled = new Promise<void>((resolve) => {
      resume = resolve
    })
    const hook: (typeof hooks)[number] = async ({ doc }) => {
      entered()
      await stalled
      return doc
    }
    hooks.push(hook)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const response = sendEvent(messageEvent(id, 'message.delivered'))
    try {
      await ready
      let status: number | undefined
      void response.then((value) => {
        status = value.status
      })
      await vi.advanceTimersByTimeAsync(5000)
      expect(status).toBe(503)
      expect(await (await response).json()).toEqual({ outcomeCode: 'webhook-unavailable' })
    } finally {
      resume()
      hooks.splice(hooks.indexOf(hook), 1)
      vi.useRealTimers()
      await response
      await vi.waitFor(() => expect(Object.keys(payload.db.sessions ?? {})).toHaveLength(0))
    }
    expect(await state()).toEqual(beforeState)
  })

  it.each(['statement', 'lock'])(
    'uses the remaining total budget for a blocked %s and rolls back all effects',
    async (failure) => {
      const id = await preparedOperation()
      const event = messageEvent(id, 'message.delivered')
      const body = JSON.stringify(event)
      const clock = performance.now.bind(performance)
      let bodyElapsed = 0
      vi.spyOn(performance, 'now').mockImplementation(() => clock() + bodyElapsed)
      await observer.query(`CREATE FUNCTION webhook_deadline_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.provider_event_id IS NOT NULL THEN PERFORM pg_sleep(2); END IF; RETURN NEW; END $$`)
      try {
        if (failure === 'lock') {
          await observer.query('BEGIN')
          await observer.query('SELECT id FROM transactional_email_outbox WHERE id = $1 FOR UPDATE', [id])
        } else {
          await observer.query(
            'CREATE TRIGGER webhook_deadline_failure BEFORE INSERT ON transactional_email_events FOR EACH ROW EXECUTE FUNCTION webhook_deadline_failure()',
          )
        }
        const stream = new ReadableStream<Uint8Array>(
          {
            pull(controller) {
              // Streaming has consumed most of the one request budget before storage starts.
              bodyElapsed = 4600
              controller.enqueue(Buffer.from(body))
              controller.close()
            },
          },
          { highWaterMark: 0 },
        )
        const started = clock()
        const response = await send({ body, stream, headers: { 'x-lettermint-event': event.event } })
        expect(response.status).toBe(503)
        expect(await response.json()).toEqual({ outcomeCode: 'webhook-unavailable' })
        expect(clock() - started).toBeLessThan(1000)
      } finally {
        if (failure === 'lock') await observer.query('ROLLBACK')
        await observer.query('DROP TRIGGER IF EXISTS webhook_deadline_failure ON transactional_email_events')
        await observer.query('DROP FUNCTION webhook_deadline_failure()')
      }
      await vi.waitFor(() => expect(Object.keys(payload.db.sessions ?? {})).toHaveLength(0))
      expect(await state()).toEqual(beforeState)
    },
  )

  it.each([
    ['succeeds', 'message.delivered'],
    ['fails', 'message.delivered'],
    ['succeeds', 'message.spam_complaint'],
    ['fails', 'message.spam_complaint'],
  ])(
    'returns 503 at the deadline when an already-started commit later %s for %s and reconciles its retry once',
    async (outcome, type) => {
      const id = await preparedOperation()
      const event = messageEvent(id, type)
      await observer.query(`CREATE FUNCTION webhook_late_commit() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.provider_event_id IS NOT NULL THEN
          PERFORM pg_sleep(6);
          ${outcome === 'fails' ? "RAISE EXCEPTION 'synthetic-private-commit-detail';" : ''}
        END IF; RETURN NEW; END $$`)
      await observer.query(
        'CREATE CONSTRAINT TRIGGER webhook_late_commit AFTER INSERT ON transactional_email_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION webhook_late_commit()',
      )
      const started = performance.now()
      try {
        const response = await sendEvent(event)
        const elapsed = performance.now() - started
        expect(response.status).toBe(503)
        expect(await response.json()).toEqual({ outcomeCode: 'webhook-unavailable' })
        expect(elapsed).toBeGreaterThanOrEqual(4900)
        expect(elapsed).toBeLessThan(5500)
        expect(await state()).toEqual(beforeState)
      } finally {
        // DDL waits for the real transaction to finish before removing the injected fault.
        await observer.query('DROP TRIGGER IF EXISTS webhook_late_commit ON transactional_email_events')
        await observer.query('DROP FUNCTION webhook_late_commit()')
      }
      if (outcome === 'fails') expect(await state()).toEqual(beforeState)
      else expect((await stored(id)).state).toBe(type === 'message.delivered' ? 'delivered' : 'complained')
      mutationExpected = true
      const retry = await sendEvent(event)
      expect(retry.status).toBe(200)
      expect(await retry.json()).toEqual({
        outcomeCode: outcome === 'succeeds' ? 'provider-event-duplicate' : 'provider-event-applied',
      })
      const events = await history(id)
      expect(events.filter((item) => item.provider_event_id === event.id)).toHaveLength(1)
      expect(events.filter((item) => item.type === 'delivery.accepted')).toHaveLength(1)
      expect(
        events.filter(
          (item) => item.type === (type === 'message.delivered' ? 'delivery.delivered' : 'delivery.complained'),
        ),
      ).toHaveLength(1)
      expect((await suppressionsFor(id)).map((entry) => entry.reason)).toEqual(
        type === 'message.spam_complaint' ? ['spam-complaint'] : [],
      )
      const committed = await state()
      expect((await sendEvent(event)).status).toBe(200)
      expect(await state()).toEqual(committed)
      expectedSignals.push({ outcomeCode: 'provider-event-mismatch' })
      expect((await sendEvent({ ...event, event: 'message.sent' })).status).toBe(200)
      expect(await state()).toEqual(committed)
    },
    15000,
  )

  it('rolls back when the deadline expires after the last event write but before commit', async () => {
    const id = await preparedOperation()
    const hooks = payload.collections.transactionalEmailEvents.config.hooks.afterChange
    const clock = performance.now.bind(performance)
    let elapsed = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock() + elapsed)
    const hook: (typeof hooks)[number] = ({ doc }) => {
      if (doc.providerEventId) elapsed = 5000
      return doc
    }
    hooks.push(hook)
    try {
      const response = await sendEvent(messageEvent(id, 'message.delivered'))
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ outcomeCode: 'webhook-unavailable' })
    } finally {
      hooks.splice(hooks.indexOf(hook), 1)
    }
    expect(await state()).toEqual(beforeState)
  })

  it.each(['message.opened', 'message.clicked', 'suppression.added'])(
    'records correlated unsubscribed %s without a delivery transition',
    async (type) => {
      const id = await preparedOperation()
      const before = await stored(id)
      const event = messageEvent(id, type)
      expectedSignals.push({ outcomeCode: 'provider-event-ignored' })
      mutationExpected = true
      expect((await sendEvent(event)).status).toBe(200)
      const after = await stored(id)
      expect(after.state).toBe('prepared')
      expect(after.provider_message_id).toBeNull()
      expect(after.next_attempt_at).toEqual(before.next_attempt_at)
      expect((await history(id)).at(-1)?.type).toBe('provider.event-ignored')
    },
  )

  it('rejects an incomplete test envelope carrying message fields', async () => {
    const event = messageEvent('2147483647', 'webhook.test')
    expect((await sendEvent(event)).status).toBe(422)
  })

  it('acknowledges an unsubscribed suppression event without message correlation', async () => {
    const event = {
      ...webhookTestEvent(),
      event: 'suppression.added',
      data: { reason: 'synthetic-private-reason', email: 'synthetic@example.test' },
    }
    expectedSignals.push({ outcomeCode: 'provider-event-unmatched' })
    const response = await send({ body: JSON.stringify(event), headers: { 'x-lettermint-event': event.event } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ outcomeCode: 'provider-event-unmatched' })
  })

  it('processes Production feedback only for its own immutable operation and provider binding', async () => {
    const previewId = await preparedOperation()
    const productionId = await preparedOperation('production')
    const event = {
      ...messageEvent(previewId, 'message.delivered'),
      context: webhookTestEvent('production').context,
      data: {
        message_id: 'production-message',
        metadata: { operation_id: previewId, command_type: 'clinic.registration-received', environment: 'production' },
      },
    }
    const options = {
      environment: 'production',
      secret: webhookConfiguration.secrets.production.LETTERMINT_WEBHOOK_SECRET!,
      headers: { 'x-lettermint-event': event.event },
    }
    expectedSignals.push({ outcomeCode: 'provider-event-mismatch' })
    const mismatch = await send({ ...options, body: JSON.stringify(event) })
    expect(mismatch.status).toBe(200)
    expect(await mismatch.json()).toEqual({ outcomeCode: 'provider-event-mismatch' })
    expect(await state()).toEqual(beforeState)
    mutationExpected = true
    event.data.metadata.operation_id = productionId
    expect((await send({ ...options, body: JSON.stringify(event) })).status).toBe(200)
    expect((await stored(productionId)).state).toBe('delivered')
    expect((await stored(previewId)).state).toBe('prepared')
  })

  it('binds a late provider reference without resurrecting a failed operation', async () => {
    const id = await preparedOperation('preview', 'permanent')
    const before = await stored(id)
    mutationExpected = true
    expect((await sendEvent(messageEvent(id, 'message.delivered'))).status).toBe(200)
    const after = await stored(id)
    expect(after.state).toBe('failed')
    expect(after.terminal_at).toEqual(before.terminal_at)
    expect(after.provider_accepted_at).toBeNull()
    expect(after.provider_message_id).toBe('synthetic-message')
    const committed = await state()
    const conflict = messageEvent(id, 'message.sent')
    conflict.data.message_id = 'foreign-message'
    expectedSignals.push({ outcomeCode: 'provider-event-mismatch' })
    const response = await sendEvent(conflict)
    expect(await response.json()).toEqual({ outcomeCode: 'provider-event-mismatch' })
    expect(await state()).toEqual(committed)
  })

  it('acknowledges an authenticated test event without persistent mutations or provider calls', async () => {
    const response = await send()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ outcomeCode: 'webhook-test-verified' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('acknowledges an authenticated webhook when the repository signal writer fails', async () => {
    vi.mocked(fallbackConsoleLogger.warn).mockImplementation(() => {
      throw new Error('synthetic-log-failure')
    })

    const response = await send()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ outcomeCode: 'webhook-test-verified' })
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
    expect(signalCalls).toContainEqual({ environment: 'preview', outcomeCode: 'webhook-unauthorized' })
  })

  it.each([-301, 301])(
    'rejects a correctly signed request outside the timestamp tolerance by %i seconds',
    async (offset) => {
      const signalOffset = signalCalls.length
      expect((await send({ timestamp: webhookNow / 1000 + offset })).status).toBe(401)
      expect(signalCalls.slice(signalOffset)).toEqual([{ environment: 'preview', outcomeCode: 'webhook-unauthorized' }])
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

  it('signals a valid-format HMAC mismatch without recording request content', async () => {
    const signalOffset = signalCalls.length

    expect((await send({ secret: 'synthetic-wrong-hmac-key' })).status).toBe(401)

    expect(signalCalls.slice(signalOffset)).toEqual([{ environment: 'preview', outcomeCode: 'webhook-unauthorized' }])
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

  it('starts the deadline at route entry before awaiting route parameters', async () => {
    const { POST } = await import('@/app/api/internal/transactional-email/lettermint/[environment]/route')
    let resolve!: (params: { environment: string }) => void
    const params = new Promise<{ environment: string }>((done) => {
      resolve = done
    })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const response = POST(
      new Request('https://webhook.example.test/api/internal/transactional-email/lettermint/preview'),
      { params },
    )
    try {
      let status: number | undefined
      void response.then((value) => {
        status = value.status
      })
      await vi.advanceTimersByTimeAsync(5000)
      expect(status).toBe(503)
      expect(await (await response).json()).toEqual({ outcomeCode: 'webhook-unavailable' })
    } finally {
      resolve({ environment: 'preview' })
      vi.useRealTimers()
      await response
    }
  })

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

  it.each(['message.created', 'message.delivered', 'unknown'])(
    'rejects an incomplete or invalid event %s without applying provider effects',
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
    const signalOffset = signalCalls.length
    expect((await send({ secret: webhookConfiguration.secrets.production.LETTERMINT_WEBHOOK_SECRET! })).status).toBe(
      503,
    )
    expect(signalCalls.slice(signalOffset)).toEqual([{ environment: 'preview', outcomeCode: 'configuration-drift' }])
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
    const signalOffset = signalCalls.length
    expect((await send({ stream, timestamp: timestamp - 300 })).status).toBe(401)
    expect(signalCalls.slice(signalOffset)).toEqual([{ environment: 'preview', outcomeCode: 'webhook-unauthorized' }])
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
