import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import pg from 'pg'
import http from 'node:http'
import https from 'node:https'
import { configToSchema } from '@payloadcms/graphql'
import { createRequire } from 'node:module'

// Payload's native dependency uses GraphQL's CommonJS instance; Vite otherwise loads its separate ESM instance.
const { graphql } = createRequire(import.meta.url)('graphql') as typeof import('graphql')
import { buildCollectionTag, getCachePolicyEntry } from '@/utilities/cachePolicy'
import { selectTransactionalEmailRuntime } from '@/features/transactionalEmail/environment'
import { openStorageCapability } from '@/features/transactionalEmail/capability'
import { collectionContractRegistry } from './contracts/collectionContractRegistry'
import { createLocalReq, getPayload, handleEndpoints, type Payload } from 'payload'
import config from '@payload-config'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'
import { syntheticEmailCatalog, syntheticRegistrationId } from '../fixtures/transactionalEmail'

vi.mock('@/auth/utilities/jwtValidation', () => ({ extractSupabaseUserData: async () => null }))

describe('transactional email command acceptance', () => {
  let payload: Payload
  let observer: pg.Client

  const commandFor = () => ({
    type: 'clinic.registration-received' as const,
    operationReference: randomUUID(),
    registrationId: syntheticRegistrationId,
  })
  const persisted = async (reference: string) => {
    const operations = await observer.query('SELECT * FROM transactional_email_outbox WHERE operation_reference = $1', [
      reference,
    ])
    const events = await observer.query(
      'SELECT e.* FROM transactional_email_events e JOIN transactional_email_outbox o ON o.id = e.outbox_id WHERE o.operation_reference = $1',
      [reference],
    )
    return { operations: operations.rows, events: events.rows }
  }
  const port = async () => bindTransactionalEmail(await createLocalReq({}, payload), syntheticEmailCatalog)

  beforeAll(async () => {
    payload = await getPayload({ config })
    observer = new pg.Client({ connectionString: process.env.DATABASE_URI })
    await observer.connect()
  }, 60000)

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })
  afterAll(async () => {
    await observer?.end()
  })

  it('returns a committed receipt and reuses its original acceptance time', async () => {
    const req = await createLocalReq({}, payload)
    const commands = bindTransactionalEmail(req, syntheticEmailCatalog)
    const command = {
      type: 'clinic.registration-received' as const,
      operationReference: randomUUID(),
      registrationId: '00000000-0000-4000-8000-000000000001',
    }

    const accepted = await commands.accept(command)
    expect(Object.keys(accepted).sort()).toEqual(['acceptedAt', 'deduplicated', 'operationId'])
    expect(accepted).toMatchObject({
      operationId: expect.any(String),
      acceptedAt: expect.any(String),
      deduplicated: false,
    })
    expect(await commands.accept(command)).toEqual({ ...accepted, deduplicated: true })
    expect(req.transactionID).toBeUndefined()
  })

  it('keeps both records invisible and the receipt pending until the owned commit finishes', async () => {
    const commands = await port()
    const command = commandFor()
    let finishCommit!: () => void
    let reachedCommit!: () => void
    const commitGate = new Promise<void>((resolve) => {
      finishCommit = resolve
    })
    const committing = new Promise<void>((resolve) => {
      reachedCommit = resolve
    })
    const commit = payload.db.commitTransaction.bind(payload.db)
    vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (id) => {
      reachedCommit()
      await commitGate
      return commit(id)
    })
    let completed = false
    const result = commands.accept(command).then((receipt) => {
      completed = true
      return receipt
    })
    await committing
    try {
      expect(completed).toBe(false)
      expect(await persisted(command.operationReference)).toEqual({ operations: [], events: [] })
    } finally {
      finishCommit()
    }
    const receipt = await result
    const stored = await persisted(command.operationReference)
    expect(stored.operations).toHaveLength(1)
    expect(stored.events).toHaveLength(1)
    expect(String(stored.operations[0].id)).toBe(receipt.operationId)
    expect(stored.operations[0].created_at.toISOString()).toBe(receipt.acceptedAt)
    expect(stored.operations[0]).toMatchObject({
      recipient_address: 'recipient@example.test',
      recipient_digest: expect.stringMatching(/^fake-v1:[a-f0-9]{64}$/),
      provider_idempotency_key: expect.any(String),
      latest_event_sequence: '1',
    })
    expect(stored.operations[0].provider_idempotency_key).not.toBe(command.operationReference)
    expect(stored.events[0]).toMatchObject({ sequence: '1', type: 'command.accepted', source: 'command' })
    await commands.accept(command)
    expect(await persisted(command.operationReference)).toEqual(stored)
  })

  it('rolls back both records after a failed event write and allows the complete command to be retried', async () => {
    const commands = await port()
    const command = commandFor()
    const hooks = payload.collections.transactionalEmailEvents.config.hooks.beforeChange
    const failEvent = () => {
      throw new Error('synthetic event fault')
    }
    hooks.push(failEvent)
    try {
      await expect(commands.accept(command)).rejects.toMatchObject({ code: 'storage-unavailable' })
    } finally {
      hooks.splice(hooks.indexOf(failEvent), 1)
    }
    expect(await persisted(command.operationReference)).toEqual({ operations: [], events: [] })
    const receipt = await commands.accept(command)
    expect(receipt.deduplicated).toBe(false)
  })

  it('retries owned serialization conflicts in full at most three times', async () => {
    const commands = await port()
    const command = commandFor()
    const serializationFailure = Object.assign(new Error('synthetic transaction conflict'), { code: '40001' })
    const start = vi.spyOn(payload.db, 'beginTransaction')
    const commit = vi.spyOn(payload.db, 'commitTransaction').mockRejectedValueOnce(serializationFailure)
    const accepted = await commands.accept(command)
    expect(accepted.deduplicated).toBe(false)
    expect(
      start.mock.calls.every(
        ([options]) => options?.isolationLevel === 'serializable' && options.accessMode === 'read write',
      ),
    ).toBe(true)
    expect(commit).toHaveBeenCalledTimes(2)
    expect((await persisted(command.operationReference)).events).toHaveLength(1)
    const failed = commandFor()
    commit.mockClear().mockRejectedValue(serializationFailure)
    await expect(commands.accept(failed)).rejects.toMatchObject({ code: 'transaction-conflict' })
    expect(commit).toHaveBeenCalledTimes(3)
    expect(await persisted(failed.operationReference)).toEqual({ operations: [], events: [] })
  })

  it('rejects unauthorized initial and duplicate commands without exposing existing-operation data', async () => {
    const commands = await port()
    const command = commandFor()
    await commands.accept(command)
    const stored = await persisted(command.operationReference)
    const req = await createLocalReq({}, payload)
    req.user = { id: 1000000001, collection: 'platformStaff' } as NonNullable<typeof req.user>
    const denied = bindTransactionalEmail(req, syntheticEmailCatalog)
    for (const input of [command, commandFor()]) {
      try {
        await denied.accept(input)
        expect.fail('An unauthorized command must reject')
      } catch (error) {
        expect(error).toMatchObject({ code: 'access-denied', message: 'access-denied' })
        expect(JSON.stringify(error)).not.toContain(stored.operations[0].created_at.toISOString())
        expect(error).not.toHaveProperty('operationId')
      }
    }
    expect(await persisted(command.operationReference)).toEqual(stored)
  })

  it.each([
    'recipientAddress',
    'link',
    'subject',
    'content',
    'template',
    'sender',
    'provider',
    'retry',
    'idempotencyKey',
    'metadata',
    'context',
  ])('rejects caller-controlled %s even for an existing operation', async (field) => {
    const commands = await port()
    const command = commandFor()
    await commands.accept(command)
    const stored = await persisted(command.operationReference)
    await expect(commands.accept({ ...command, [field]: 'forbidden' })).rejects.toMatchObject({
      code: 'invalid-command',
    })
    expect(await persisted(command.operationReference)).toEqual(stored)
  })

  it('rejects invalid commands, missing source records, and catalog gaps before persisting', async () => {
    const commands = await port()
    const command = commandFor()
    await expect(commands.accept({ ...command, registrationId: randomUUID() })).rejects.toMatchObject({
      code: 'source-missing',
    })
    await expect(commands.accept({ ...command, operationReference: 'recipient@example.test' })).rejects.toMatchObject({
      code: 'invalid-command',
    })
    await expect(commands.accept({ ...command, type: 'send' } as never)).rejects.toMatchObject({
      code: 'unsupported-command',
    })
    const unregistered = bindTransactionalEmail(await createLocalReq({}, payload))
    await expect(unregistered.accept(command)).rejects.toMatchObject({ code: 'unsupported-command' })
    expect(await persisted(command.operationReference)).toEqual({ operations: [], events: [] })
  })

  it('returns unavailable storage without starting partial work or joining a caller transaction', async () => {
    const commands = await port()
    const command = commandFor()
    vi.spyOn(payload.db, 'beginTransaction').mockResolvedValueOnce(null)
    await expect(commands.accept(command)).rejects.toMatchObject({ code: 'storage-unavailable' })
    const req = await createLocalReq({ req: { transactionID: 'caller-owned' } }, payload)
    await expect(bindTransactionalEmail(req, syntheticEmailCatalog).accept(command)).rejects.toMatchObject({
      code: 'storage-unavailable',
    })
    expect(req.transactionID).toBe('caller-owned')
    expect(await persisted(command.operationReference)).toEqual({ operations: [], events: [] })
  })

  it.each(['transactionalEmailOutbox', 'transactionalEmailEvents'] as const)(
    'denies every normal Local API operation on %s, including forged context and overrideAccess',
    async (collection) => {
      const commands = await port()
      const receipt = await commands.accept(commandFor())
      const id = Number(receipt.operationId)
      for (const overrideAccess of [false, true]) {
        for (const context of [
          {},
          { transactionalEmail: true },
          { transactionalEmail: {} },
          { transactionalEmail: { internal: true } },
        ]) {
          const req = await createLocalReq({ context, req: { transactionID: 'forged-transaction' } }, payload)
          for (const operation of [
            () => payload.find({ collection, req, overrideAccess }),
            () => payload.count({ collection, req, overrideAccess }),
            () => payload.findByID({ collection, id, req, overrideAccess }),
            () => payload.create({ collection, data: {} as never, req, overrideAccess }),
            () => payload.update({ collection, id, data: {}, req, overrideAccess }),
            () => payload.delete({ collection, id, req, overrideAccess }),
          ])
            await expect(operation()).rejects.toMatchObject({ code: 'access-denied' })
        }
      }
    },
  )

  it('binds storage capability to its transaction and rejects reuse after closing it', async () => {
    const capability = openStorageCapability('owned-transaction')
    const req = await createLocalReq(
      { context: capability.context, req: { transactionID: 'other-transaction' } },
      payload,
    )
    await expect(payload.find({ collection: 'transactionalEmailOutbox', req })).rejects.toMatchObject({
      code: 'access-denied',
    })
    capability.close()
    req.transactionID = 'owned-transaction'
    await expect(payload.find({ collection: 'transactionalEmailOutbox', req })).rejects.toMatchObject({
      code: 'access-denied',
    })
  })

  it('rejects provider key replacement and event updates even within a valid internal transaction', async () => {
    const command = commandFor()
    const receipt = await (await port()).accept(command)
    const records = await persisted(command.operationReference)
    for (const target of ['provider-key', 'event'] as const) {
      const transactionID = await payload.db.beginTransaction()
      if (transactionID === null) throw new Error('Expected a test transaction')
      const capability = openStorageCapability(transactionID)
      const req = await createLocalReq({ context: capability.context, req: { transactionID } }, payload)
      try {
        if (target === 'provider-key')
          await expect(
            payload.update({
              collection: 'transactionalEmailOutbox',
              id: Number(receipt.operationId),
              data: { providerIdempotencyKey: randomUUID() },
              req,
            }),
          ).rejects.toMatchObject({ code: 'access-denied' })
        else
          await expect(
            payload.update({
              collection: 'transactionalEmailEvents',
              id: records.events[0].id,
              data: { sequence: 2 },
              req,
            }),
          ).rejects.toMatchObject({ code: 'access-denied' })
      } finally {
        capability.close()
        await payload.db.rollbackTransaction(transactionID)
      }
    }
    expect(await persisted(command.operationReference)).toEqual(records)
  })

  it('keeps both registered collections hidden from Admin, REST, GraphQL, and public caches', async () => {
    const policy = getCachePolicyEntry('collection:private-operational')
    expect(policy).toMatchObject({ cacheClass: 'private-live', tagFamilies: [], pathRelationship: 'private-live' })
    for (const collection of ['transactionalEmailOutbox', 'transactionalEmailEvents'] as const) {
      const collectionConfig = payload.collections[collection].config
      expect(collectionConfig.admin.hidden).toBe(true)
      expect(await collectionConfig.access.admin?.({ req: await createLocalReq({}, payload) })).toBe(false)
      expect(collectionContractRegistry[collection].baseline).toContain(
        'tests/integration/transactionalEmail.acceptance.test.ts',
      )
      expect(policy.collections).toContain(collection)
      expect(() => buildCollectionTag(collection)).toThrow('not public-cache taggable')
      for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
        const response = await handleEndpoints({
          config,
          request: new Request(`https://mail-boundary.test/api/${collection}`, { method }),
        })
        expect(response.status).toBe(501)
      }
    }
    const resolved = await config
    // Existing unrelated relationships prevent the repository-wide GraphQL schema from building.
    // Use real sanitized mail configs and Countries as a positive query/mutation control.
    const { schema } = configToSchema({
      ...resolved,
      collections: resolved.collections.filter((entry) =>
        ['countries', 'transactionalEmailOutbox', 'transactionalEmailEvents'].includes(entry.slug),
      ),
      globals: [],
    })
    for (const rootType of [schema.getQueryType(), schema.getMutationType()]) {
      const fields = Object.keys(rootType?.getFields() ?? {})
      expect(fields.some((name) => /countr/i.test(name))).toBe(true)
      expect(fields.filter((name) => /transactionalEmail/i.test(name))).toEqual([])
    }
    const body = await graphql({
      schema,
      source: '{ TransactionalEmailOutbox { docs { id } } TransactionalEmailEvents { docs { id } } }',
    })
    expect(body.data).toBeUndefined()
    expect(body.errors).toHaveLength(2)
    expect(body.errors?.every((error: { message: string }) => error.message.includes('Cannot query field'))).toBe(true)
  })

  it('installs the business-operation, provider-key, event-order and nullable provider-event constraints in Postgres', async () => {
    const indexes = await observer.query(
      "SELECT indexdef FROM pg_indexes WHERE tablename IN ('transactional_email_outbox', 'transactional_email_events')",
    )
    const definitions = indexes.rows.map((row) => row.indexdef as string)
    for (const fields of [
      '(command_type, operation_reference)',
      '(provider_idempotency_key)',
      '(outbox_id, sequence)',
      '(provider_event_id)',
    ]) {
      expect(definitions.some((definition) => definition.includes('UNIQUE INDEX') && definition.includes(fields))).toBe(
        true,
      )
    }
    const command = commandFor()
    await (await port()).accept(command)
    const before = await persisted(command.operationReference)
    // The database rejects an insertion outside Payload too; application validation is not the unique authority.
    const copyOperation = `INSERT INTO transactional_email_outbox
      (command_type, operation_reference, command_payload, runtime_environment, state, provider_idempotency_key, recipient_address, recipient_digest, latest_event_sequence)
      SELECT command_type, $2, command_payload, runtime_environment, state, $3, recipient_address, recipient_digest, latest_event_sequence
      FROM transactional_email_outbox WHERE operation_reference = $1`
    await expect(
      observer.query(copyOperation, [command.operationReference, command.operationReference, randomUUID()]),
    ).rejects.toMatchObject({ code: '23505', constraint: 'commandType_operationReference_idx' })
    await expect(
      observer.query(copyOperation, [
        command.operationReference,
        randomUUID(),
        before.operations[0].provider_idempotency_key,
      ]),
    ).rejects.toMatchObject({ code: '23505', constraint: 'transactional_email_outbox_provider_idempotency_key_idx' })
    await expect(
      observer.query(
        'INSERT INTO transactional_email_events (outbox_id, sequence, type, source) VALUES ($1, 1, $2, $3)',
        [before.operations[0].id, 'command.accepted', 'command'],
      ),
    ).rejects.toMatchObject({ code: '23505', constraint: 'outbox_sequence_idx' })
    expect(await persisted(command.operationReference)).toEqual(before)
  })

  it.each(['local', 'test', 'ci'] as const)(
    'uses fake boundaries and makes no external network call in %s',
    async (environment) => {
      vi.stubEnv('VERCEL_ENV', undefined)
      vi.stubEnv('DEPLOYMENT_ENV', environment)
      vi.stubEnv('NODE_ENV', environment === 'test' ? 'test' : 'development')
      vi.stubEnv('CI', environment === 'ci' ? 'true' : 'false')
      const blocked = () => {
        throw new Error('External mail, link generation, and PostHog traffic is forbidden')
      }
      const fetchGuard = vi.spyOn(globalThis, 'fetch').mockImplementation(blocked)
      const httpGuard = vi.spyOn(http, 'request').mockImplementation(blocked)
      const httpsGuard = vi.spyOn(https, 'request').mockImplementation(blocked)
      expect(selectTransactionalEmailRuntime()).toEqual({ environment, delivery: 'fake', links: 'fake' })
      const accepted = await (await port()).accept(commandFor())
      expect(accepted.deduplicated).toBe(false)
      expect(fetchGuard).not.toHaveBeenCalled()
      expect(httpGuard).not.toHaveBeenCalled()
      expect(httpsGuard).not.toHaveBeenCalled()
    },
  )

  it.each([
    { DEPLOYMENT_ENV: 'preview' },
    { DEPLOYMENT_ENV: 'production' },
    { VERCEL_ENV: 'preview', DEPLOYMENT_ENV: 'test', CI: 'true' },
    { VERCEL_ENV: 'development', DEPLOYMENT_ENV: 'production', CI: 'true' },
    { DEPLOYMENT_ENV: 'unknown' },
    { NODE_ENV: 'production' },
  ])('fails before command or worker initialization without hosted adapters: %j', async (environment) => {
    for (const key of ['VERCEL_ENV', 'DEPLOYMENT_ENV', 'CI']) vi.stubEnv(key, undefined)
    vi.stubEnv('NODE_ENV', 'development')
    for (const [key, value] of Object.entries(environment)) vi.stubEnv(key, value)
    const start = vi.spyOn(payload.db, 'beginTransaction')
    const req = await createLocalReq({}, payload)
    expect(() => selectTransactionalEmailRuntime()).toThrow('environment-unavailable')
    expect(() => bindTransactionalEmail(req, syntheticEmailCatalog)).toThrow('environment-unavailable')
    expect(start).not.toHaveBeenCalled()
  })
})
