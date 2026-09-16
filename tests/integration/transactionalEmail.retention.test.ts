import { randomUUID } from 'node:crypto'
import http from 'node:http'
import https from 'node:https'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'
import pg from 'pg'
import config from '@payload-config'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'
import { openStorageCapability } from '@/features/transactionalEmail/capability'
import { runOwnedTransaction } from '@/features/transactionalEmail/transactions'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import { syntheticEmailCatalog, syntheticRegistrationId } from '../fixtures/transactionalEmail'
import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'

vi.mock('@/auth/utilities/jwtValidation', () => ({ extractSupabaseUserData: async () => null }))

describe('transactional email safety sweep and retention', () => {
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
      throw new Error('External network forbidden by retention contract')
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
  const row = async (id: string) =>
    (await observer.query('SELECT * FROM transactional_email_outbox WHERE id = $1', [id])).rows[0]
  const accept = async () => {
    const req = await createLocalReq({}, payload)
    const operationReference = randomUUID()
    references.push(operationReference)
    const receipt = await bindTransactionalEmail(req, syntheticEmailCatalog).accept({
      type: 'clinic.registration-received',
      operationReference,
      registrationId: syntheticRegistrationId,
    })
    return { req, id: receipt.operationId }
  }
  it('expires abandoned content during an empty worker invocation before any preparation', async () => {
    const { req, id } = await accept()
    const initial = await row(id)
    const now = initial.delivery_deadline.getTime() + 1
    const links = { generate: vi.fn() }
    await createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog, links, now: () => now }).run()
    const stored = await row(id)
    expect(stored.state).toBe('expired')
    expect(stored.command_payload).toBeNull()
    expect(stored.recipient_address).toBeNull()
    expect(stored.terminal_at.getTime()).toBe(now)
    expect(stored.scrubbed_at.getTime()).toBe(now)
    expect(links.generate).not.toHaveBeenCalled()
    const events = await observer.query(
      'SELECT type FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence',
      [id],
    )
    expect(events.rows.map(({ type }) => type)).toEqual(['command.accepted', 'delivery.expired', 'payload.scrubbed'])
  })
  it('retains deduplication until day 42, then deletes the outbox and all events atomically', async () => {
    const { req, id } = await accept()
    await createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog }).run(id)
    const stored = await row(id)
    const day42 = stored.terminal_at.getTime() + 42 * 86400000
    await createTransactionalEmailWorker(req, { now: () => day42 - 1 }).run()
    expect(await row(id)).toBeDefined()
    const duplicate = await bindTransactionalEmail(req, syntheticEmailCatalog).accept({
      type: 'clinic.registration-received',
      operationReference: stored.operation_reference,
      registrationId: syntheticRegistrationId,
    })
    expect(duplicate).toMatchObject({ operationId: id, deduplicated: true })
    await createTransactionalEmailWorker(req, { now: () => day42 }).run()
    expect(await row(id)).toBeUndefined()
    expect((await observer.query('SELECT id FROM transactional_email_events WHERE outbox_id = $1', [id])).rows).toEqual(
      [],
    )
  })

  it('honors the deadline boundary and the simulated 30-minute runner cadence', async () => {
    const { req, id } = await accept()
    const deadline = (await row(id)).delivery_deadline.getTime()
    let clock = deadline
    const worker = createTransactionalEmailWorker(req, { now: () => clock })
    await worker.run()
    expect((await row(id)).state).toBe('queued')
    clock += 30 * 60000
    await worker.run()
    const scrubbed = await row(id)
    expect(scrubbed.scrubbed_at.getTime() - deadline).toBeLessThanOrEqual(3600000)
    expect(scrubbed.state).toBe('expired')
    clock += 30 * 60000
    await worker.run()
    const repeated = await row(id)
    expect(repeated.scrubbed_at).toEqual(scrubbed.scrubbed_at)
    expect(repeated.terminal_at).toEqual(scrubbed.terminal_at)
    expect(repeated.latest_event_sequence).toBe(scrubbed.latest_event_sequence)
  })

  it.each(['accepted', 'delivered', 'suppressed', 'bounced', 'complained', 'failed', 'expired'])(
    'repairs unscrubbed %s without replacing its outcome or retention clock',
    async (state) => {
      const { req, id } = await accept()
      const now = Date.now()
      const terminal = new Date(now - 86400000)
      // Model interrupted/legacy persistence containing transient data despite a recorded outcome.
      await observer.query(
        "UPDATE transactional_email_outbox SET state = $2, terminal_at = $3, provider_message_id = 'fake-message', prepared_subject = 'synthetic subject', prepared_html = '<p>synthetic</p>', prepared_text = 'synthetic', lease_token = 'stale', lease_expires_at = $4, next_attempt_at = $4 WHERE id = $1",
        [id, state, terminal, new Date(now + 60000)],
      )
      await createTransactionalEmailWorker(req, { now: () => now }).run()
      const stored = await row(id)
      expect(stored.state).toBe(state)
      expect(stored.terminal_at).toEqual(terminal)
      expect(stored.provider_message_id).toBe('fake-message')
      expect(stored.scrubbed_at.getTime()).toBe(now)
      const allowed = [
        'id',
        'created_at',
        'updated_at',
        'command_type',
        'operation_reference',
        'runtime_environment',
        'state',
        'provider_idempotency_key',
        'recipient_digest',
        'provider_message_id',
        'attempt_count',
        'latest_event_sequence',
        'prepared_at',
        'delivery_deadline',
        'last_attempt_at',
        'first_ambiguous_at',
        'provider_accepted_at',
        'terminal_at',
        'scrubbed_at',
      ]
      expect(
        Object.entries(stored)
          .filter(([, value]) => value != null)
          .map(([key]) => key)
          .filter((key) => !allowed.includes(key)),
      ).toEqual([])
      const events = await observer.query(
        'SELECT type FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence',
        [id],
      )
      expect(events.rows.map(({ type }) => type)).toEqual(['command.accepted', 'payload.scrubbed'])
    },
  )

  it('scrubs an expired prepared operation with an active lease and rejects its stale worker', async () => {
    const { req, id } = await accept()
    const original = await row(id)
    let clock = original.delivery_deadline.getTime() - 60000
    const delivery = { deliver: vi.fn() }
    const worker = createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog, delivery, now: () => clock })
    const claim = await worker.claim(id)
    expect(claim).not.toBeNull()
    // Simulate process loss after preparation while the original lease is still valid.
    await observer.query(
      "UPDATE transactional_email_outbox SET state = 'prepared', prepared_subject = 'synthetic', prepared_html = '<p>synthetic</p>', prepared_text = 'synthetic', prepared_at = $2 WHERE id = $1",
      [id, new Date(clock)],
    )
    clock += 60001
    await createTransactionalEmailWorker(req, { now: () => clock }).run()
    await worker.processClaim(claim!)
    expect(delivery.deliver).not.toHaveBeenCalled()
    const stored = await row(id)
    expect(stored.state).toBe('expired')
    for (const field of [
      'command_payload',
      'recipient_address',
      'prepared_subject',
      'prepared_html',
      'prepared_text',
      'lease_token',
      'lease_expires_at',
      'next_attempt_at',
    ])
      expect(stored[field]).toBeNull()
  })

  it('rolls back both deletions when the final outbox deletion fails, then retries cleanly', async () => {
    const { req, id } = await accept()
    await createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog }).run(id)
    const stored = await row(id)
    const now = stored.terminal_at.getTime() + 42 * 86400000
    const hooks = payload.collections.transactionalEmailOutbox.config.hooks
    const original = hooks.afterDelete
    hooks.afterDelete = [
      ...(original ?? []),
      () => {
        throw new Error('synthetic retention failure')
      },
    ]
    try {
      await expect(createTransactionalEmailWorker(req, { now: () => now }).run()).rejects.toMatchObject({
        code: 'storage-unavailable',
      })
    } finally {
      hooks.afterDelete = original
    }
    expect(await row(id)).toBeDefined()
    expect(
      (await observer.query('SELECT count(*)::int AS count FROM transactional_email_events WHERE outbox_id = $1', [id]))
        .rows[0].count,
    ).toBe(Number(stored.latest_event_sequence))
    await createTransactionalEmailWorker(req, { now: () => now + 24 * 3600000 }).run()
    expect(await row(id)).toBeUndefined()
    expect((await observer.query('SELECT id FROM transactional_email_events WHERE outbox_id = $1', [id])).rows).toEqual(
      [],
    )
  })

  it('serializes concurrent sweeps without duplicate scrubbing events or orphaned metadata', async () => {
    const { req, id } = await accept()
    const deadline = (await row(id)).delivery_deadline.getTime()
    const run = (now: number) => createTransactionalEmailWorker(req, { now: () => now }).run()
    await Promise.all([run(deadline + 1), run(deadline + 1)])
    const stored = await row(id)
    expect(Number(stored.latest_event_sequence)).toBe(3)
    await Promise.all([run(deadline + 1 + 42 * 86400000), run(deadline + 1 + 42 * 86400000)])
    expect(await row(id)).toBeUndefined()
    expect((await observer.query('SELECT id FROM transactional_email_events WHERE outbox_id = $1', [id])).rows).toEqual(
      [],
    )
  })

  it('keeps an in-flight worker from restoring payload or acceptance after the safety sweep', async () => {
    const { req, id } = await accept()
    const deadline = (await row(id)).delivery_deadline.getTime()
    let clock = deadline - 10000
    let entered!: () => void
    let release!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const delivery = {
      deliver: vi.fn(async () => {
        entered()
        await pending
        return { type: 'accepted' as const, messageId: 'fake-late-acceptance' }
      }),
    }
    const processing = createTransactionalEmailWorker(req, {
      catalog: syntheticEmailCatalog,
      delivery,
      now: () => clock,
    }).run(id)
    await started
    try {
      clock = deadline + 1
      await createTransactionalEmailWorker(req, { now: () => clock }).run()
    } finally {
      release()
    }
    await processing
    const stored = await row(id)
    expect(stored.state).toBe('expired')
    expect(stored.provider_message_id).toBeNull()
    expect(stored.prepared_html).toBeNull()
    expect(delivery.deliver).toHaveBeenCalledTimes(1)
  })

  it('denies deletion to ordinary internal command and worker capabilities', async () => {
    const { req, id } = await accept()
    const event = (await observer.query('SELECT id FROM transactional_email_events WHERE outbox_id = $1', [id])).rows[0]
    for (const authority of [
      undefined,
      { kind: 'worker' as const, token: 'synthetic', now: Date.now },
      { kind: 'sweep' as const, token: 'synthetic', now: Date.now },
    ]) {
      await expect(
        runOwnedTransaction(req, async (_, transactionID) => {
          const capability = openStorageCapability(transactionID, authority)
          try {
            const internalReq = await createLocalReq(
              { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
              payload,
            )
            await payload.delete({
              collection: 'transactionalEmailEvents',
              id: event.id,
              req: internalReq,
              overrideAccess: true,
            })
          } finally {
            capability.close()
          }
        }),
      ).rejects.toMatchObject({ code: 'access-denied' })
    }
    expect(
      (await observer.query('SELECT id FROM transactional_email_events WHERE outbox_id = $1', [id])).rows,
    ).toHaveLength(1)
  })

  it('retains the original terminal timestamp when a late metadata write attempts to extend retention', async () => {
    const { req, id } = await accept()
    await createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog }).run(id)
    const original = await row(id)
    const now = original.terminal_at.getTime() + 86400000
    // Legacy unsanitized content makes this a valid sweep target; its recorded terminal clock remains immutable.
    await observer.query(
      "UPDATE transactional_email_outbox SET prepared_text = 'synthetic remainder', scrubbed_at = NULL WHERE id = $1",
      [id],
    )
    const hooks = payload.collections.transactionalEmailOutbox.config.hooks
    const before = hooks.beforeChange
    hooks.beforeChange = [({ data }) => ({ ...data, terminalAt: new Date(now).toISOString() }), ...(before ?? [])]
    try {
      await expect(createTransactionalEmailWorker(req, { now: () => now }).run()).rejects.toMatchObject({
        code: 'access-denied',
      })
    } finally {
      hooks.beforeChange = before
    }
    expect((await row(id)).terminal_at).toEqual(original.terminal_at)
    await createTransactionalEmailWorker(req, { now: () => now }).run()
    expect((await row(id)).terminal_at).toEqual(original.terminal_at)
  })

  it('finishes the sweep before generating links for another due message', async () => {
    const expired = await accept()
    const due = await accept()
    const now = Date.now()
    await observer.query('UPDATE transactional_email_outbox SET delivery_deadline = $2 WHERE id = $1', [
      expired.id,
      new Date(now - 1),
    ])
    const links = {
      generate: vi.fn(async () => {
        expect((await row(expired.id)).state).toBe('expired')
        expect((await row(expired.id)).command_payload).toBeNull()
        return 'https://example.test/synthetic-action'
      }),
    }
    await createTransactionalEmailWorker(due.req, { catalog: syntheticEmailCatalog, links, now: () => now }).run(due.id)
    expect(links.generate).toHaveBeenCalledTimes(1)
    expect((await row(due.id)).state).toBe('accepted')
  })
  it('continues beyond the first candidate page while rows disappear during retention', async () => {
    const created = []
    for (let index = 0; index < 101; index++) created.push(await accept())
    const last = await row(created.at(-1)!.id)
    const now = last.delivery_deadline.getTime() + 1
    const req = created[0]!.req
    await createTransactionalEmailWorker(req, { now: () => now }).run()
    const ids = created.map(({ id }) => id)
    const expired = await observer.query('SELECT state FROM transactional_email_outbox WHERE id = ANY($1)', [ids])
    expect(expired.rows).toHaveLength(101)
    expect(expired.rows.every(({ state }) => state === 'expired')).toBe(true)
    await createTransactionalEmailWorker(req, { now: () => now + 42 * 86400000 }).run()
    expect((await observer.query('SELECT id FROM transactional_email_outbox WHERE id = ANY($1)', [ids])).rows).toEqual(
      [],
    )
    expect(
      (await observer.query('SELECT id FROM transactional_email_events WHERE outbox_id = ANY($1)', [ids])).rows,
    ).toEqual([])
  }, 30000)

  it('leaves another runtime environment untouched', async () => {
    const { req, id } = await accept()
    const deadline = (await row(id)).delivery_deadline.getTime()
    await observer.query("UPDATE transactional_email_outbox SET runtime_environment = 'local' WHERE id = $1", [id])
    await createTransactionalEmailWorker(req, { now: () => deadline + 1 }).run()
    expect((await row(id)).state).toBe('queued')
    expect((await row(id)).command_payload).not.toBeNull()
  })

  it('scrubs outstanding content before deleting an older metadata backlog', async () => {
    const retained = await accept()
    await createTransactionalEmailWorker(retained.req, { catalog: syntheticEmailCatalog }).run(retained.id)
    const expired = await accept()
    const now = (await row(retained.id)).terminal_at.getTime() + 42 * 86400000
    const hooks = payload.collections.transactionalEmailOutbox.config.hooks
    const original = hooks.beforeDelete
    let checked = false
    hooks.beforeDelete = [
      ...(original ?? []),
      async () => {
        expect((await row(expired.id)).state).toBe('expired')
        expect((await row(expired.id)).command_payload).toBeNull()
        checked = true
      },
    ]
    try {
      await createTransactionalEmailWorker(retained.req, { now: () => now }).run()
    } finally {
      hooks.beforeDelete = original
    }
    expect(checked).toBe(true)
  })
  it.each([
    { auth: false, state: 'queued' },
    { auth: false, state: 'prepared' },
    { auth: true, state: 'queued' },
    { auth: true, state: 'prepared' },
  ])('scrubs legacy NULL deadlines for auth=$auth state=$state during an empty run', async ({ auth, state }) => {
    const req = await createLocalReq({}, payload)
    const now = Date.now()
    const operationReference = randomUUID()
    references.push(operationReference)
    const receipt = auth
      ? await bindTransactionalEmail(req, {
          'auth.password-recovery': {
            authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: syntheticRegistrationId }),
            authValidity: async () => ({ actionAt: new Date(now).toISOString(), lifetimeMilliseconds: 7200000 }),
          },
        }).accept({ type: 'auth.password-recovery', operationReference, recoveryId: syntheticRegistrationId })
      : await bindTransactionalEmail(req, syntheticEmailCatalog).accept({
          type: 'clinic.registration-received',
          operationReference,
          registrationId: syntheticRegistrationId,
        })
    const id = receipt.operationId
    const control = await accept()
    // Model rows preserved by the nullable deadline migration, with prepared data from an interrupted worker.
    const legacy = async (operationId: string, createdAt: number) =>
      observer.query(
        "UPDATE transactional_email_outbox SET delivery_deadline = NULL, created_at = $2, state = $3, prepared_at = $2, prepared_subject = 'synthetic', prepared_html = '<p>synthetic</p>', prepared_text = 'synthetic' WHERE id = $1",
        [operationId, new Date(createdAt), state],
      )
    await legacy(id, auth ? now : now - 86400001)
    await legacy(control.id, now - 3600000)
    await createTransactionalEmailWorker(req, { now: () => now }).run()
    const expired = await row(id)
    expect(expired.state).toBe('expired')
    expect(expired.terminal_at.getTime()).toBe(now)
    expect(expired.scrubbed_at.getTime()).toBe(now)
    for (const field of ['command_payload', 'recipient_address', 'prepared_subject', 'prepared_html', 'prepared_text'])
      expect(expired[field]).toBeNull()
    const retained = await row(control.id)
    expect(retained.state).toBe(state)
    expect(retained.command_payload).not.toBeNull()
    expect(retained.recipient_address).toBe('recipient@example.test')
    expect(retained.scrubbed_at).toBeNull()
  })

  it('scrubs the exhausted ambiguity window even while the stored auth deadline is still future', async () => {
    const req = await createLocalReq({}, payload)
    let clock = Date.now()
    const actionAt = new Date(clock).toISOString()
    const operationReference = randomUUID()
    references.push(operationReference)
    const catalog = {
      'auth.password-recovery': {
        authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: syntheticRegistrationId }),
        authValidity: async () => ({ actionAt, lifetimeMilliseconds: 48 * 3600000 }),
        worker: {
          template: 'synthetic-notification' as const,
          terminalState: 'failed' as const,
          revalidate: async () => ({ address: 'recipient@example.test', binding: syntheticRegistrationId }),
        },
      },
    }
    const receipt = await bindTransactionalEmail(req, catalog, () => clock).accept({
      type: 'auth.password-recovery',
      operationReference,
      recoveryId: syntheticRegistrationId,
    })
    const delivery = { deliver: vi.fn(async () => ({ type: 'ambiguous' as const })) }
    const worker = createTransactionalEmailWorker(req, { catalog, delivery, now: () => clock })
    await worker.run(receipt.operationId)
    clock += 86400001
    expect((await row(receipt.operationId)).delivery_deadline.getTime()).toBeGreaterThan(clock)
    await worker.run()
    const expired = await row(receipt.operationId)
    expect(expired.state).toBe('expired')
    expect(expired.command_payload).toBeNull()
    expect(expired.prepared_html).toBeNull()
    expect(delivery.deliver).toHaveBeenCalledTimes(1)
  })
})
