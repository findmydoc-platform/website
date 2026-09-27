import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import http from 'node:http'
import https from 'node:https'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'
import pg from 'pg'
import config from '@payload-config'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import { resolveActivationPolicy } from '@/features/transactionalEmail/activationPolicy'
import type { DeliveryAttempt } from '@/features/transactionalEmail/delivery'
import { resolveHostedLettermintBinding } from '@/features/transactionalEmail/hostedConfiguration'
import { workerTransaction } from '@/features/transactionalEmail/workerStorage'
import { webhookNow } from '../fixtures/lettermintWebhook'
import { createActivationFixture } from '../fixtures/transactionalEmailActivation'
import { syntheticEmailCatalog, syntheticRegistrationId } from '../fixtures/transactionalEmail'
import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'

vi.mock('@/auth/utilities/jwtValidation', () => ({ extractSupabaseUserData: async () => null }))

describe('immutable provider preparation through the worker', () => {
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

  it('rolls the additive migration down and up without changing an existing queued operation', async () => {
    const { operationId } = await accept()
    const before = await stored(operationId)
    const migrations = await payload.find({ collection: 'payload-migrations', pagination: false })
    const migration = migrations.docs.find(
      ({ name }) => name === '20260927_063204_transactional_email_provider_preparation',
    )
    expect(migration).toBeDefined()
    const batch = Math.max(...migrations.docs.map(({ batch }) => batch ?? 0)) + 1
    await payload.update({ collection: 'payload-migrations', id: migration!.id, data: { batch } })
    const providerColumns = [
      'prepared_provider_request',
      'provider_team_id',
      'provider_project_id',
      'provider_route_id',
    ]
    const migrationEnv: NodeJS.ProcessEnv = { ...process.env, PAYLOAD_DATABASE_OPERATION: 'migration' }
    delete migrationEnv.DATABASE_DIRECT_URI
    const database = new URL(migrationEnv.DATABASE_URI!)
    expect(['localhost', '127.0.0.1']).toContain(database.hostname)
    expect(database.pathname).toMatch(/^\/findmydoc-test(?:[-_][a-z0-9_-]+)?$/)
    try {
      execFileSync('pnpm', ['payload', 'migrate:down'], { env: migrationEnv, stdio: 'pipe', timeout: 60_000 })
      const rolledBack = await stored(operationId)
      expect(Object.keys(rolledBack)).not.toEqual(expect.arrayContaining(providerColumns))
      expect(rolledBack).toEqual(
        Object.fromEntries(Object.entries(before).filter(([key]) => !providerColumns.includes(key))),
      )
    } finally {
      execFileSync('bash', ['.codex/scripts/payload-migration.sh', 'migrate'], {
        env: migrationEnv,
        stdio: 'pipe',
        timeout: 60_000,
      })
    }
    expect(await stored(operationId)).toEqual(before)
  }, 120_000)

  it('requires an explicit suppression clearance before links or delivery', async () => {
    const { req, operationId } = await accept()
    const links = { generate: vi.fn(async () => 'https://example.test/action') }
    const delivery = { deliver: vi.fn(async () => ({ type: 'retryable' as const })) }
    await createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog, links, delivery }).run(operationId)
    expect(links.generate).not.toHaveBeenCalled()
    expect(delivery.deliver).not.toHaveBeenCalled()
    expect(await stored(operationId)).toMatchObject({ state: 'queued', prepared_at: null, attempt_count: '0' })
  })

  it('commits a closed single-message body and target before the first delivery attempt', async () => {
    const { req, operationId } = await accept()
    const fixture = createActivationFixture()
    let committed: Record<string, unknown> | undefined
    const delivery = {
      deliver: vi.fn(async (_attempt: DeliveryAttempt) => {
        committed = await stored(operationId)
        return { type: 'retryable' as const }
      }),
    }
    await createTransactionalEmailWorker(req, {
      ...providerOptions(fixture),
      delivery,
    }).run(operationId)
    expect(delivery.deliver).toHaveBeenCalledOnce()
    const attempt = delivery.deliver.mock.calls[0]![0]
    expect(committed).toBeDefined()
    {
      const row = committed!
      expect(row.prepared_provider_request).toBeTypeOf('string')
      expect(attempt.providerRequest).toEqual({
        body: row.prepared_provider_request,
        teamId: 'team-preview',
        projectId: 'project-preview',
        routeId: 'route-preview',
      })
      expect(row).toMatchObject({
        provider_team_id: 'team-preview',
        provider_project_id: 'project-preview',
        provider_route_id: 'route-preview',
      })
      expect(JSON.parse(row.prepared_provider_request as string)).toEqual({
        from: fixture.binding.target.sender,
        to: ['recipient@example.test'],
        subject: row.prepared_subject,
        html: row.prepared_html,
        text: row.prepared_text,
        route: 'route-preview',
        settings: { track_opens: false, track_clicks: false },
        metadata: { operation_id: operationId, command_type: 'clinic.registration-received', environment: 'preview' },
      })
    }
    expect((await stored(operationId)).prepared_provider_request).toBeTypeOf('string')
  })

  it.each(['missing', 'unavailable', 'throws', 'suppressed'] as const)(
    'stops provider preparation when suppression is %s',
    async (decision) => {
      const { req, operationId } = await accept()
      const links = { generate: vi.fn(async () => 'https://example.test/action') }
      const delivery = { deliver: vi.fn(async () => ({ type: 'retryable' as const })) }
      const suppression =
        decision === 'missing'
          ? undefined
          : async () => {
              if (decision === 'throws') throw new Error('Private store error')
              return decision
            }
      await createTransactionalEmailWorker(req, { ...providerOptions(), suppression, links, delivery }).run(operationId)
      expect(links.generate).not.toHaveBeenCalled()
      expect(delivery.deliver).not.toHaveBeenCalled()
      expect(await stored(operationId)).toMatchObject({
        prepared_provider_request: null,
        provider_team_id: null,
        provider_project_id: null,
        provider_route_id: null,
        prepared_at: null,
        attempt_count: '0',
      })
    },
  )

  it('reuses byte-identical requests after recreation and reviewed sender changes', async () => {
    const { req, operationId } = await accept()
    let now = Date.now()
    const links = { generate: vi.fn(async () => 'https://example.test/action?value=ümlaut') }
    const delivery = { deliver: vi.fn(async (_attempt: DeliveryAttempt) => ({ type: 'retryable' as const })) }
    await createTransactionalEmailWorker(req, { ...providerOptions(), links, delivery, now: () => now }).run(
      operationId,
    )
    const before = await stored(operationId)
    const rotated = createActivationFixture()
    rotated.configuration.registry.targets[0]!.sender = 'rotated@example.test'
    rotated.preflight.target.sender = 'rotated@example.test'
    now += 60_000
    await createTransactionalEmailWorker(req, { ...providerOptions(rotated), links, delivery, now: () => now }).run(
      operationId,
    )
    expect(links.generate).toHaveBeenCalledOnce()
    expect(delivery.deliver).toHaveBeenCalledTimes(2)
    expect(delivery.deliver.mock.calls[1]![0]).toEqual(delivery.deliver.mock.calls[0]![0])
    expect((await stored(operationId)).prepared_provider_request).toBe(before.prepared_provider_request)
  })

  it.each(['teamId', 'projectId', 'routeId', 'environment', 'missing'] as const)(
    'rejects %s target drift without rewriting or another attempt',
    async (field) => {
      const { req, operationId } = await accept()
      let now = Date.now()
      const delivery = { deliver: vi.fn(async () => ({ type: 'retryable' as const })) }
      await createTransactionalEmailWorker(req, { ...providerOptions(), delivery, now: () => now }).run(operationId)
      const before = await stored(operationId)
      const changed = createActivationFixture(field === 'environment' ? 'production' : 'preview')
      if (field !== 'environment' && field !== 'missing') {
        changed.configuration.registry.targets[0]![field] += '-changed'
        changed.configuration.registry.targets[0]!.activatedTarget[field] += '-changed'
        changed.configuration.locks.targets[0]![field] += '-changed'
        changed.preflight.target[field] += '-changed'
        for (const fingerprint of changed.configuration.registry.fingerprints)
          if (fingerprint.environment === 'preview') fingerprint[field] += '-changed'
      }
      const options = providerOptions(changed)
      now += 60_000
      await expect(
        createTransactionalEmailWorker(req, {
          ...options,
          ...(field === 'missing' ? { providerBinding: undefined } : {}),
          delivery,
          now: () => now,
        }).run(operationId),
      ).rejects.toMatchObject({ code: 'environment-unavailable' })
      const after = await stored(operationId)
      expect(delivery.deliver).toHaveBeenCalledOnce()
      for (const key of [
        'prepared_provider_request',
        'provider_team_id',
        'provider_project_id',
        'provider_route_id',
        'attempt_count',
      ])
        expect(after[key]).toBe(before[key])
    },
  )

  it('rolls back provider bytes, target and attempt when the audit write fails', async () => {
    const { req, operationId } = await accept()
    const hooks = payload.collections.transactionalEmailEvents.config.hooks
    const original = hooks.beforeChange
    hooks.beforeChange = [
      ...(original ?? []),
      ({ data }) => {
        if (data.type === 'delivery.attempt-started') throw new Error('Synthetic audit failure')
        return data
      },
    ]
    const delivery = { deliver: vi.fn(async () => ({ type: 'retryable' as const })) }
    try {
      await expect(
        createTransactionalEmailWorker(req, { ...providerOptions(), delivery }).run(operationId),
      ).rejects.toMatchObject({ code: 'storage-unavailable' })
    } finally {
      hooks.beforeChange = original
    }
    expect(delivery.deliver).not.toHaveBeenCalled()
    expect(await stored(operationId)).toMatchObject({
      state: 'prepared',
      prepared_provider_request: null,
      provider_team_id: null,
      provider_project_id: null,
      provider_route_id: null,
      attempt_count: '0',
    })
  })

  it('rejects duplicated metadata keys before committing provider bytes', async () => {
    const { req, operationId } = await accept()
    const hooks = payload.collections.transactionalEmailOutbox.config.hooks
    const original = hooks.beforeChange
    hooks.beforeChange = [
      ({ data }) => {
        if (data.preparedProviderRequest)
          data.preparedProviderRequest = data.preparedProviderRequest.replace(
            '"metadata":',
            '"metadata":{"business_reference":"forbidden"},"metadata":',
          )
        return data
      },
      ...(original ?? []),
    ]
    try {
      await expect(createTransactionalEmailWorker(req, providerOptions()).run(operationId)).rejects.toMatchObject({
        code: 'access-denied',
      })
    } finally {
      hooks.beforeChange = original
    }
    expect((await stored(operationId)).prepared_provider_request).toBeNull()
  })

  it.each([
    'cc',
    'bcc',
    'attachments',
    'headers',
    'reply_to',
    'scheduled_at',
    'batch',
    'template_id',
    'business_reference',
    'metadata',
  ])('rejects forbidden request field %s at persistence', async (field) => {
    const { req, operationId } = await accept()
    const hooks = payload.collections.transactionalEmailOutbox.config.hooks
    const original = hooks.beforeChange
    hooks.beforeChange = [
      ({ data }) => {
        if (data.preparedProviderRequest) {
          const body = JSON.parse(data.preparedProviderRequest)
          if (field === 'metadata') body.metadata.business_reference = 'forbidden'
          else body[field] = 'forbidden'
          data.preparedProviderRequest = JSON.stringify(body)
        }
        return data
      },
      ...(original ?? []),
    ]
    const delivery = { deliver: vi.fn(async () => ({ type: 'retryable' as const })) }
    try {
      await expect(
        createTransactionalEmailWorker(req, { ...providerOptions(), delivery }).run(operationId),
      ).rejects.toMatchObject({ code: 'access-denied' })
    } finally {
      hooks.beforeChange = original
    }
    expect(delivery.deliver).not.toHaveBeenCalled()
    expect(await stored(operationId)).toMatchObject({
      prepared_provider_request: null,
      provider_team_id: null,
      provider_project_id: null,
      provider_route_id: null,
      attempt_count: '0',
    })
  })

  it.each(['body', 'team', 'project', 'route'] as const)(
    'denies changes to stored %s through a valid worker lease',
    async (field) => {
      const { req, operationId } = await accept()
      let now = Date.now()
      const worker = createTransactionalEmailWorker(req, {
        ...providerOptions(),
        now: () => now,
        delivery: { deliver: async () => ({ type: 'retryable' }) },
      })
      await worker.run(operationId)
      now += 60_000
      const claim = await worker.claim(operationId)
      expect(claim).not.toBeNull()
      const before = await stored(operationId)
      await expect(
        workerTransaction(req, { kind: 'worker', token: claim!.token, now: () => now }, async (storage) => {
          const record = await storage.read(Number(operationId))
          const data =
            field === 'body'
              ? {
                  preparedProviderRequest: record.preparedProviderRequest!.replace(
                    '"from":"preview@example.test"',
                    '"from":"changed@example.test"',
                  ),
                }
              : field === 'team'
                ? { providerTeamId: 'changed-team' }
                : field === 'project'
                  ? { providerProjectId: 'changed-project' }
                  : { providerRouteId: 'changed-route' }
          return storage.write(record, data, [])
        }),
      ).rejects.toMatchObject({ code: 'access-denied' })
      expect(await stored(operationId)).toEqual(before)
    },
  )

  it.each(['accepted', 'expired'] as const)(
    'scrubs bytes on %s while retaining binding until normal deletion',
    async (outcome) => {
      const { req, operationId } = await accept()
      let now = Date.now()
      const options = { ...providerOptions(), now: () => now }
      await createTransactionalEmailWorker(req, {
        ...options,
        delivery: { deliver: async () => ({ type: 'retryable' }) },
      }).run(operationId)
      expect((await stored(operationId)).prepared_provider_request).toBeTypeOf('string')
      now += outcome === 'accepted' ? 60_000 : 86_400_001
      const worker = createTransactionalEmailWorker(req, {
        ...options,
        delivery: { deliver: async () => ({ type: 'accepted', messageId: 'synthetic-provider-reference' }) },
      })
      await worker.run(outcome === 'accepted' ? operationId : undefined)
      const scrubbed = await stored(operationId)
      expect(scrubbed).toMatchObject({
        state: outcome,
        prepared_provider_request: null,
        recipient_address: null,
        prepared_subject: null,
        prepared_html: null,
        prepared_text: null,
        provider_team_id: 'team-preview',
        provider_project_id: 'project-preview',
        provider_route_id: 'route-preview',
      })
      now = scrubbed.terminal_at.getTime() + 42 * 86_400_000 - 1
      await worker.run()
      expect(await stored(operationId)).toBeDefined()
      now += 1
      await worker.run()
      expect(await stored(operationId)).toBeUndefined()
      expect(
        (await observer.query('SELECT id FROM transactional_email_events WHERE outbox_id = $1', [operationId])).rows,
      ).toHaveLength(0)
    },
  )

  it('checks suppression again after rendering and before serialization', async () => {
    const { req, operationId } = await accept()
    let checks = 0
    const suppression = vi.fn(async () => (++checks < 3 ? ('cleared' as const) : ('unavailable' as const)))
    const delivery = { deliver: vi.fn(async () => ({ type: 'retryable' as const })) }
    await createTransactionalEmailWorker(req, { ...providerOptions(), suppression, delivery }).run(operationId)
    expect(suppression).toHaveBeenCalledTimes(3)
    expect(delivery.deliver).not.toHaveBeenCalled()
    expect(await stored(operationId)).toMatchObject({
      state: 'prepared',
      prepared_provider_request: null,
      provider_team_id: null,
      provider_project_id: null,
      provider_route_id: null,
      attempt_count: '0',
    })
  })

  it('rejects a provider target without its matching activation policy before worker work', async () => {
    const { req } = await accept()
    const options = providerOptions()
    const foreign = providerOptions(createActivationFixture('production'))
    expect(() => createTransactionalEmailWorker(req, { ...options, providerBinding: foreign.providerBinding })).toThrow(
      'environment-unavailable',
    )
    expect(() =>
      createTransactionalEmailWorker(req, { ...options, providerBinding: { ...options.providerBinding } }),
    ).toThrow('environment-unavailable')
  })
})
