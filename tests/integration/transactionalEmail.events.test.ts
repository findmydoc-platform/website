import http from 'node:http'
import https from 'node:https'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'
import pg from 'pg'
import config from '@payload-config'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import { transientFields } from '@/features/transactionalEmail/retentionPolicy'
import type { TransactionalEmailOutbox } from '@/payload-types'
import { openStorageCapability } from '@/features/transactionalEmail/capability'
import { runOwnedTransaction } from '@/features/transactionalEmail/transactions'
import { appendProviderEvent } from '@/features/transactionalEmail/providerEvents'
import { syntheticEmailCatalog, syntheticRegistrationId } from '../fixtures/transactionalEmail'
import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'

vi.mock('@/auth/utilities/jwtValidation', () => ({ extractSupabaseUserData: async () => null }))

describe('transactional email event invariants', () => {
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
      throw new Error('External network forbidden by event contract')
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(deny)
    vi.spyOn(http, 'request').mockImplementation(deny)
    vi.spyOn(https, 'request').mockImplementation(deny)
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    while (references.length) await cleanupTransactionalEmailFixtures(payload, references.splice(0, 80))
  })
  afterAll(async () => {
    await observer?.end()
  })
  const accept = async () => {
    const req = await createLocalReq({}, payload)
    const operationReference = randomUUID()
    references.push(operationReference)
    const receipt = await bindTransactionalEmail(req, syntheticEmailCatalog).accept({
      type: 'clinic.registration-received',
      operationReference,
      registrationId: syntheticRegistrationId,
    })
    return { req, id: Number(receipt.operationId) }
  }
  const overlappingReads = async <Result>(id: number, work: () => Promise<Result>) => {
    const hooks = payload.collections.transactionalEmailOutbox.config.hooks
    const original = hooks.afterRead
    const transactions = new Set<unknown>()
    let release!: () => void
    const ready = new Promise<void>((resolve) => {
      release = resolve
    })
    hooks.afterRead = [
      ...(original ?? []),
      async ({ doc, req }) => {
        if (doc.id !== id) return doc
        transactions.add(await req.transactionID)
        if (transactions.size >= 2) release()
        await ready
        return doc
      },
    ]
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        work(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            release()
            reject(new Error('Concurrent storage reads did not overlap'))
          }, 5000)
        }),
      ])
      expect(transactions.size).toBeGreaterThanOrEqual(3)
      return result
    } finally {
      release()
      clearTimeout(timeout)
      hooks.afterRead = original
    }
  }
  it('returns the existing provider event without adding history or allocating another sequence', async () => {
    const { req, id } = await accept()
    const input = { outbox: id, providerEventId: randomUUID(), type: 'delivery.delivered' as const }
    const first = await appendProviderEvent(req, input)
    expect(await appendProviderEvent(req, input)).toEqual(first)
    const events = await observer.query(
      'SELECT sequence::int, type FROM transactional_email_events WHERE outbox_id=$1 ORDER BY sequence',
      [id],
    )
    expect(events.rows).toEqual([
      { sequence: 1, type: 'command.accepted' },
      { sequence: 2, type: 'delivery.delivered' },
    ])
    expect(
      (await observer.query('SELECT latest_event_sequence::int FROM transactional_email_outbox WHERE id=$1', [id]))
        .rows[0].latest_event_sequence,
    ).toBe(2)
  })
  it('serializes a worker claim and provider input using sequence instead of provider time', async () => {
    const { req, id } = await accept()
    const worker = createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog })
    const [claim] = await overlappingReads(id, () =>
      Promise.all([
        worker.claim(String(id)),
        appendProviderEvent(req, {
          outbox: id,
          providerEventId: randomUUID(),
          type: 'delivery.delivered',
          sourceOccurredAt: '2000-01-01T00:00:00.000Z',
        }),
      ]),
    )
    expect(claim).not.toBeNull()
    const events = (
      await observer.query(
        'SELECT sequence::int, type FROM transactional_email_events WHERE outbox_id=$1 ORDER BY sequence',
        [id],
      )
    ).rows
    expect(events.map(({ sequence }) => sequence)).toEqual([1, 2, 3])
    expect(events.map(({ type }) => type).sort()).toEqual(['command.accepted', 'delivery.delivered', 'lease.acquired'])
    expect(
      (await observer.query('SELECT latest_event_sequence::int FROM transactional_email_outbox WHERE id=$1', [id]))
        .rows[0].latest_event_sequence,
    ).toBe(3)
  })
  it('deduplicates concurrent identical provider input in real transactions', async () => {
    const { req, id } = await accept()
    const input = { outbox: id, providerEventId: randomUUID(), type: 'delivery.bounced' as const }
    const results = await overlappingReads(id, () =>
      Promise.all([appendProviderEvent(req, input), appendProviderEvent(req, input)]),
    )
    expect(results[0]).toEqual(results[1])
    expect(
      (await observer.query('SELECT count(*)::int AS count FROM transactional_email_events WHERE outbox_id=$1', [id]))
        .rows[0].count,
    ).toBe(2)
  })
  it.each(['delivered', 'bounced', 'complained'] as const)(
    'allows accepted to %s without extending retention or restoring content',
    async (state) => {
      const { req, id } = await accept()
      await createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog }).run(String(id))
      const before = (await observer.query('SELECT * FROM transactional_email_outbox WHERE id=$1', [id])).rows[0]
      await appendProviderEvent(req, {
        outbox: id,
        providerEventId: randomUUID(),
        type: `delivery.${state}`,
        transitionTo: state,
      })
      const after = (await observer.query('SELECT * FROM transactional_email_outbox WHERE id=$1', [id])).rows[0]
      expect(after.state).toBe(state)
      expect(after.terminal_at).toEqual(before.terminal_at)
      expect(after.scrubbed_at).toEqual(before.scrubbed_at)
      for (const field of [
        'command_payload',
        'recipient_address',
        'prepared_subject',
        'prepared_html',
        'prepared_text',
      ])
        expect(after[field]).toBeNull()
    },
  )
  it('does not decide precedence for contradictory outcomes but can record an explicitly ignored event', async () => {
    const { req, id } = await accept()
    await createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog }).run(String(id))
    await appendProviderEvent(req, {
      outbox: id,
      providerEventId: randomUUID(),
      type: 'delivery.delivered',
      transitionTo: 'delivered',
    })
    const input = { outbox: id, providerEventId: randomUUID(), type: 'delivery.bounced' as const }
    await expect(appendProviderEvent(req, { ...input, transitionTo: 'bounced' })).rejects.toMatchObject({
      code: 'access-denied',
    })
    const event = await appendProviderEvent(req, input)
    expect(await appendProviderEvent(req, input)).toEqual(event)
    expect((await observer.query('SELECT state FROM transactional_email_outbox WHERE id=$1', [id])).rows[0].state).toBe(
      'delivered',
    )
  })
  it('rolls back the sequence counter when an event insert fails', async () => {
    const { req, id } = await accept()
    const hooks = payload.collections.transactionalEmailEvents.config.hooks
    const before = hooks.afterChange
    hooks.afterChange = [
      ...(before ?? []),
      () => {
        throw new Error('synthetic append failure')
      },
    ]
    try {
      await expect(
        appendProviderEvent(req, { outbox: id, providerEventId: randomUUID(), type: 'delivery.delivered' }),
      ).rejects.toMatchObject({ code: 'storage-unavailable' })
    } finally {
      hooks.afterChange = before
    }
    expect(
      (await observer.query('SELECT latest_event_sequence::int FROM transactional_email_outbox WHERE id=$1', [id]))
        .rows[0].latest_event_sequence,
    ).toBe(1)
    expect(
      (await observer.query('SELECT count(*)::int AS count FROM transactional_email_events WHERE outbox_id=$1', [id]))
        .rows[0].count,
    ).toBe(1)
  })
  it('rejects normal and direct internal event updates, including overrideAccess', async () => {
    const { req, id } = await accept()
    const event = await appendProviderEvent(req, {
      outbox: id,
      providerEventId: randomUUID(),
      type: 'delivery.delivered',
    })
    await expect(
      payload.update({
        collection: 'transactionalEmailEvents',
        id: event.id,
        data: { type: 'delivery.bounced' },
        overrideAccess: true,
        req,
      }),
    ).rejects.toMatchObject({ code: 'access-denied' })
    await expect(
      runOwnedTransaction(req, async (_, transactionID) => {
        const capability = openStorageCapability(transactionID)
        try {
          const internalReq = await createLocalReq(
            { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
            payload,
          )
          await payload.update({
            collection: 'transactionalEmailEvents',
            id: event.id,
            data: { type: 'delivery.bounced' },
            overrideAccess: true,
            req: internalReq,
          })
        } finally {
          capability.close()
        }
      }),
    ).rejects.toMatchObject({ code: 'access-denied' })
    expect(
      (await observer.query('SELECT type FROM transactional_email_events WHERE id=$1', [event.id])).rows[0].type,
    ).toBe('delivery.delivered')
  })
  it('proves the migrated compound and partial uniqueness in PostgreSQL', async () => {
    const { req, id } = await accept()
    const identity = randomUUID()
    await appendProviderEvent(req, { outbox: id, providerEventId: identity, type: 'delivery.delivered' })
    await expect(
      observer.query(
        "INSERT INTO transactional_email_events(outbox_id,sequence,type,source) VALUES($1,2,'delivery.bounced','provider')",
        [id],
      ),
    ).rejects.toMatchObject({ code: '23505', constraint: 'outbox_sequence_idx' })
    await expect(
      observer.query(
        "INSERT INTO transactional_email_events(outbox_id,sequence,type,source,provider_event_id) VALUES($1,3,'delivery.bounced','provider',$2)",
        [id, identity],
      ),
    ).rejects.toMatchObject({ code: '23505', constraint: 'transactional_email_events_provider_event_id_idx' })
    await observer.query(
      "INSERT INTO transactional_email_events(outbox_id,sequence,type,source,provider_event_id) VALUES($1,3,'delivery.bounced','provider',NULL),($1,4,'delivery.bounced','provider',NULL),($1,5,'delivery.bounced','provider',''),($1,6,'delivery.bounced','provider','')",
      [id],
    )
    const index = (
      await observer.query(
        "SELECT indexdef FROM pg_indexes WHERE indexname='transactional_email_events_provider_event_id_idx'",
      )
    ).rows[0].indexdef
    expect(index).toContain('WHERE')
    expect(index).toContain('IS NOT NULL')
  })
  it.each(['', ' ', 'recipient@example.test'])(
    'rejects invalid identities without storing content: %j',
    async (providerEventId) => {
      const { req, id } = await accept()
      await expect(
        appendProviderEvent(req, { outbox: id, providerEventId, type: 'delivery.delivered' }),
      ).rejects.toMatchObject({ code: 'invalid-command' })
      expect(
        (await observer.query('SELECT count(*)::int AS count FROM transactional_email_events WHERE outbox_id=$1', [id]))
          .rows[0].count,
      ).toBe(1)
    },
  )
  it('rejects every state transition outside the explicit foundation graph through Payload', async () => {
    const { req, id } = await accept()
    const states: TransactionalEmailOutbox['state'][] = [
      'queued',
      'prepared',
      'accepted',
      'delivered',
      'suppressed',
      'bounced',
      'complained',
      'failed',
      'expired',
    ]
    const allowed = new Set([
      'queued:prepared',
      'queued:suppressed',
      'queued:failed',
      'queued:expired',
      'prepared:accepted',
      'prepared:suppressed',
      'prepared:failed',
      'prepared:expired',
      'accepted:delivered',
      'accepted:bounced',
      'accepted:complained',
    ])
    const original = (await observer.query('SELECT * FROM transactional_email_outbox WHERE id=$1', [id])).rows[0]
    const now = Date.now()
    for (const from of states) {
      await observer.query(
        'UPDATE transactional_email_outbox SET state=$2, lease_token=$3, lease_expires_at=$4, prepared_subject=$5, prepared_html=$5, prepared_text=$5, prepared_at=$6, terminal_at=$6, scrubbed_at=$6 WHERE id=$1',
        [id, from, 'synthetic-lease', new Date(now + 60000), 'synthetic', new Date(now)],
      )
      for (const to of states) {
        if (from === to || allowed.has(`${from}:${to}`)) continue
        await expect(
          runOwnedTransaction(req, async (_, transactionID) => {
            const capability = openStorageCapability(transactionID, {
              kind: 'worker',
              token: 'synthetic-lease',
              now: () => now,
            })
            try {
              const internalReq = await createLocalReq(
                { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
                payload,
              )
              const active = to === 'queued' || to === 'prepared'
              await payload.update({
                collection: 'transactionalEmailOutbox',
                id,
                req: internalReq,
                depth: 0,
                data: {
                  state: to,
                  ...(active
                    ? { commandPayload: original.command_payload, recipientAddress: original.recipient_address }
                    : transientFields),
                },
              })
            } finally {
              capability.close()
            }
          }),
          `${from} -> ${to}`,
        ).rejects.toMatchObject({ code: 'access-denied' })
        expect(
          (await observer.query('SELECT state FROM transactional_email_outbox WHERE id=$1', [id])).rows[0].state,
        ).toBe(from)
      }
    }
  })
  it('keeps provider storage private, content-free, and bound to its original operation', async () => {
    const { req, id } = await accept()
    const other = await accept()
    const input = { outbox: id, providerEventId: randomUUID(), type: 'delivery.delivered' as const }
    const event = await appendProviderEvent(req, input)
    await expect(appendProviderEvent(req, { ...input, outbox: other.id })).rejects.toMatchObject({
      code: 'access-denied',
    })
    const withContent = { ...input, providerEventId: randomUUID(), metadata: { body: 'synthetic private content' } }
    await expect(appendProviderEvent(req, withContent)).rejects.toMatchObject({ code: 'invalid-command' })
    await expect(
      payload.find({
        collection: 'transactionalEmailEvents',
        overrideAccess: true,
        context: { transactionalEmail: {} },
      }),
    ).rejects.toMatchObject({ code: 'access-denied' })
    const stored = (await observer.query('SELECT * FROM transactional_email_events WHERE id=$1', [event.id])).rows[0]
    expect(Object.keys(stored).sort()).toEqual(
      [
        'attempt_number',
        'created_at',
        'id',
        'outbox_id',
        'outcome_code',
        'provider_event_id',
        'sequence',
        'source',
        'source_occurred_at',
        'type',
        'updated_at',
      ].sort(),
    )
    expect(stored.source).toBe('provider')
    expect(stored.outcome_code).toBeNull()
    const publicModule = await import('@/features/transactionalEmail')
    expect(Object.keys(publicModule)).toEqual(['TransactionalEmailError'])
  })
})
