import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type CollectionBeforeChangeHook } from 'payload'
import pg from 'pg'
import http from 'node:http'
import https from 'node:https'
import type { CommandCatalog } from '@/features/transactionalEmail/catalog'
import { openStorageCapability } from '@/features/transactionalEmail/capability'
import config from '@payload-config'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import { syntheticEmailCatalog, syntheticRegistrationId } from '../fixtures/transactionalEmail'

vi.mock('@/auth/utilities/jwtValidation', () => ({ extractSupabaseUserData: async () => null }))

describe('transactional email worker', () => {
  let payload: Payload
  let observer: pg.Client
  const ownedReferences = new Set<string>()
  const operationReference = () => {
    const reference = randomUUID()
    ownedReferences.add(reference)
    return reference
  }
  beforeAll(async () => {
    payload = await getPayload({ config })
    observer = new pg.Client({ connectionString: process.env.DATABASE_URI })
    await observer.connect()
  }, 60000)
  beforeEach(() => {
    vi.stubEnv('CI', 'false')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })
  const row = async (id: string) =>
    (await observer.query('SELECT * FROM transactional_email_outbox WHERE id = $1', [id])).rows[0]
  const accept = async () => {
    const req = await createLocalReq({}, payload)
    const receipt = await bindTransactionalEmail(req, syntheticEmailCatalog).accept({
      type: 'clinic.registration-received',
      operationReference: operationReference(),
      registrationId: syntheticRegistrationId,
    })
    return { req, id: receipt.operationId }
  }
  afterAll(async () => {
    try {
      await cleanupTransactionalEmailFixtures(payload, [...ownedReferences])
      const remaining = await observer.query(
        'SELECT count(*)::int AS count FROM transactional_email_outbox WHERE operation_reference = ANY($1)',
        [[...ownedReferences]],
      )
      expect(remaining.rows[0].count).toBe(0)
    } finally {
      await observer?.end()
    }
  })

  it.each([5001, 5000, 0, -1])('enforces the delivery completion budget with %i ms left', async (remaining) => {
    const { req, id } = await accept()
    const original = await row(id)
    const delivery = { deliver: vi.fn(async () => ({ type: 'accepted' as const, messageId: 'fake-boundary' })) }
    await createTransactionalEmailWorker(req, {
      catalog: syntheticEmailCatalog,
      delivery,
      now: () => original.delivery_deadline.getTime() - remaining,
    }).run(id)
    expect(delivery.deliver).toHaveBeenCalledTimes(remaining > 5000 ? 1 : 0)
    expect((await row(id)).state).toBe(remaining > 5000 ? 'accepted' : 'expired')
  })

  it('aborts a stalled delivery inside the lease budget and schedules only an ambiguous retry', async () => {
    const { req, id } = await accept()
    let signal: AbortSignal | undefined
    await createTransactionalEmailWorker(req, {
      catalog: syntheticEmailCatalog,
      delivery: {
        deliver: async (_, deliverySignal) => {
          signal = deliverySignal
          return new Promise(() => {})
        },
      },
    }).run(id)
    expect(signal?.aborted).toBe(true)
    expect(await row(id)).toMatchObject({ state: 'prepared', lease_token: null })
    expect((await row(id)).first_ambiguous_at).toEqual((await row(id)).last_attempt_at)
  })

  it('rejects the crash seam outside a test runner', async () => {
    const { req } = await accept()
    vi.stubEnv('VITEST', 'false')
    expect(() =>
      createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog, crashAfterDelivery: () => {} }),
    ).toThrow('environment-unavailable')
  })

  it('rejects auth acceptance without authoritative action validity', async () => {
    const req = await createLocalReq({}, payload)
    const catalog: CommandCatalog = {
      'auth.password-recovery': {
        authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: syntheticRegistrationId }),
      },
    }
    const reference = operationReference()
    await expect(
      bindTransactionalEmail(req, catalog).accept({
        type: 'auth.password-recovery',
        operationReference: reference,
        recoveryId: syntheticRegistrationId,
      }),
    ).rejects.toMatchObject({ code: 'invalid-command' })
    expect(
      (await observer.query('SELECT id FROM transactional_email_outbox WHERE operation_reference = $1', [reference]))
        .rows,
    ).toHaveLength(0)
  })

  it('treats a thrown adapter result as ambiguous without logging its raw error', async () => {
    const { req, id } = await accept()
    const log = vi.fn()
    const worker = createTransactionalEmailWorker(req, {
      catalog: syntheticEmailCatalog,
      log,
      delivery: {
        deliver: async () => {
          throw Error('recipient@example.test private link')
        },
      },
    })
    await worker.run(id)
    expect((await row(id)).state).toBe('prepared')
    expect((await row(id)).first_ambiguous_at).toEqual((await row(id)).last_attempt_at)
    expect(log).toHaveBeenCalledWith({
      operationId: id,
      commandType: 'clinic.registration-received',
      attemptNumber: 1,
      outcomeCode: 'ambiguous',
      environment: 'test',
    })
    expect(JSON.stringify(log.mock.calls)).not.toContain('recipient@example.test')
  })

  it.each(['retryable', 'ambiguous'] as const)(
    'uses all five fixed delays and stops after six %s attempts',
    async (outcome) => {
      const { req, id } = await accept()
      let clock = Date.now()
      const deny = () => {
        throw Error('External network forbidden')
      }
      const fetchGuard = vi.spyOn(globalThis, 'fetch').mockImplementation(deny)
      const httpGuard = vi.spyOn(http, 'request').mockImplementation(deny)
      const httpsGuard = vi.spyOn(https, 'request').mockImplementation(deny)
      const delivery = { deliver: vi.fn(async () => ({ type: outcome })) }
      const worker = createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog, now: () => clock, delivery })
      await worker.run(id)
      const first = await row(id)
      for (const [index, delay] of [60000, 300000, 1800000, 7200000, 28800000].entries()) {
        expect((await row(id)).next_attempt_at.getTime()).toBe(clock + delay)
        clock += delay - 1
        await worker.run(id)
        expect(delivery.deliver).toHaveBeenCalledTimes(index + 1)
        clock += 1
        await worker.run(id)
        expect(delivery.deliver).toHaveBeenCalledTimes(index + 2)
      }
      const terminal = await row(id)
      expect(terminal).toMatchObject({
        state: 'expired',
        command_payload: null,
        prepared_html: null,
        next_attempt_at: null,
        lease_token: null,
      })
      expect(Number(terminal.attempt_count)).toBe(6)
      if (outcome === 'ambiguous') expect(terminal.first_ambiguous_at).toEqual(first.last_attempt_at)
      clock += 86400000
      await worker.run(id)
      expect(delivery.deliver).toHaveBeenCalledTimes(6)
      expect(fetchGuard).not.toHaveBeenCalled()
      expect(httpGuard).not.toHaveBeenCalled()
      expect(httpsGuard).not.toHaveBeenCalled()
    },
  )

  it.each(['permanent', 'suppressed'] as const)('never retries a %s adapter result', async (type) => {
    const { req, id } = await accept()
    let clock = Date.now()
    const delivery = { deliver: vi.fn(async () => ({ type })) }
    const worker = createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog, now: () => clock, delivery })
    await worker.run(id)
    clock += 120000
    await worker.run(id)
    expect(delivery.deliver).toHaveBeenCalledTimes(1)
    expect((await row(id)).state).toBe(type === 'permanent' ? 'failed' : 'suppressed')
  })

  it.each(['address', 'binding', 'ineligible'] as const)(
    'revalidates %s before a retry without new adapter work',
    async (change) => {
      const { req, id } = await accept()
      let clock = Date.now()
      let eligible = true
      const catalog: CommandCatalog = {
        'clinic.registration-received': {
          ...syntheticEmailCatalog['clinic.registration-received']!,
          worker: {
            ...syntheticEmailCatalog['clinic.registration-received']!.worker!,
            revalidate: async () =>
              !eligible && change === 'ineligible'
                ? null
                : {
                    address: !eligible && change === 'address' ? 'other@example.test' : 'recipient@example.test',
                    binding: !eligible && change === 'binding' ? randomUUID() : syntheticRegistrationId,
                  },
          },
        },
      }
      const links = { generate: vi.fn(async () => 'https://example.test/once') }
      const delivery = { deliver: vi.fn(async () => ({ type: 'ambiguous' as const })) }
      const worker = createTransactionalEmailWorker(req, { catalog, now: () => clock, links, delivery })
      await worker.run(id)
      eligible = false
      clock += 60000
      await worker.run(id)
      expect(delivery.deliver).toHaveBeenCalledTimes(1)
      expect(links.generate).toHaveBeenCalledTimes(1)
      expect(await row(id)).toMatchObject({ state: 'suppressed', prepared_html: null, recipient_address: null })
    },
  )

  it('fixes the auth deadline at the original action and does not extend the ambiguity window on retry', async () => {
    const req = await createLocalReq({}, payload)
    const actionAt = Date.now() - 3600000
    let clock = actionAt + 3600000
    const catalog: CommandCatalog = {
      'auth.password-recovery': {
        authorizeAndResolve: async () => ({ address: 'recipient@example.test', binding: syntheticRegistrationId }),
        authValidity: async () => ({ actionAt: new Date(actionAt).toISOString(), lifetimeMilliseconds: 48 * 3600000 }),
        worker: {
          template: 'synthetic-notification',
          terminalState: 'failed',
          revalidate: async () => ({ address: 'recipient@example.test', binding: syntheticRegistrationId }),
        },
      },
    }
    const receipt = await bindTransactionalEmail(req, catalog, () => clock).accept({
      type: 'auth.password-recovery',
      operationReference: operationReference(),
      recoveryId: syntheticRegistrationId,
    })
    const id = receipt.operationId
    expect((await row(id)).delivery_deadline.getTime()).toBe(actionAt + 48 * 3600000 - 300000)
    clock += 3600000
    const firstRequest = clock
    const links = { generate: vi.fn(async () => 'https://example.test/auth') }
    const delivery = { deliver: vi.fn(async () => ({ type: 'ambiguous' as const })) }
    const worker = createTransactionalEmailWorker(req, { catalog, now: () => clock, links, delivery })
    await worker.run(id)
    clock += 60000
    await worker.run(id)
    expect((await row(id)).first_ambiguous_at.getTime()).toBe(firstRequest)
    clock = firstRequest + 86400000 - 5000
    await worker.run(id)
    expect(delivery.deliver).toHaveBeenCalledTimes(2)
    expect(links.generate).toHaveBeenCalledTimes(1)
    expect(await row(id)).toMatchObject({
      state: 'expired',
      command_payload: null,
      prepared_text: null,
      next_attempt_at: null,
    })
  })

  it('reclaims a crash after fake return with the consumed attempt and unchanged prepared bytes', async () => {
    const { req, id } = await accept()
    let clock = Date.now()
    const attempts: unknown[] = []
    const links = { generate: vi.fn(async () => 'https://example.test/one-link') }
    const delivery = {
      deliver: vi.fn(async (attempt: unknown) => {
        attempts.push(attempt)
        return { type: 'accepted' as const, messageId: 'fake-crash' }
      }),
    }
    const crashed = createTransactionalEmailWorker(req, {
      catalog: syntheticEmailCatalog,
      now: () => clock,
      links,
      delivery,
      crashAfterDelivery: () => {
        throw Error('deterministic crash')
      },
    })
    await expect(crashed.run(id)).rejects.toThrow('deterministic crash')
    expect(Number((await row(id)).attempt_count)).toBe(1)
    clock += 120000
    const recovered = createTransactionalEmailWorker(req, {
      catalog: syntheticEmailCatalog,
      now: () => clock,
      links,
      delivery,
    })
    const claims = await Promise.all([recovered.claim(id), recovered.claim(id)])
    expect(claims.filter(Boolean)).toHaveLength(1)
    await recovered.processClaim(claims.find(Boolean)!)
    expect((await row(id)).state).toBe('accepted')
    expect(Number((await row(id)).attempt_count)).toBe(2)
    expect(attempts[1]).toEqual(attempts[0])
    expect(links.generate).toHaveBeenCalledTimes(1)
  })

  it('expires an unprepared non-auth operation at its original acceptance deadline without generating a link', async () => {
    const { req, id } = await accept()
    const original = await row(id)
    const links = { generate: vi.fn() }
    const delivery = { deliver: vi.fn() }
    await createTransactionalEmailWorker(req, {
      catalog: syntheticEmailCatalog,
      links,
      delivery,
      now: () => original.created_at.getTime() + 86400000 - 5000,
    }).run(id)
    expect((await row(id)).state).toBe('expired')
    expect((await row(id)).command_payload).toBeNull()
    expect(links.generate).not.toHaveBeenCalled()
    expect(delivery.deliver).not.toHaveBeenCalled()
  })

  it('waits one minute after a retryable result and reuses the exact stored request', async () => {
    const { req, id } = await accept()
    let clock = Date.now()
    const attempts: unknown[] = []
    const delivery = {
      deliver: vi.fn(async (attempt: unknown) => {
        attempts.push(attempt)
        return attempts.length === 1
          ? { type: 'retryable' as const }
          : { type: 'accepted' as const, messageId: 'fake-retry' }
      }),
    }
    const worker = createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog, now: () => clock, delivery })
    await worker.run(id)
    expect((await row(id)).state).toBe('prepared')
    clock += 59999
    await worker.run(id)
    expect(delivery.deliver).toHaveBeenCalledTimes(1)
    clock += 1
    await worker.run(id)
    expect(delivery.deliver).toHaveBeenCalledTimes(2)
    expect(attempts[1]).toEqual(attempts[0])
    expect((await row(id)).state).toBe('accepted')
  })

  it('persists preparation and the started attempt before fake acceptance, then scrubs atomically', async () => {
    const req = await createLocalReq({}, payload)
    const receipt = await bindTransactionalEmail(req, syntheticEmailCatalog).accept({
      type: 'clinic.registration-received',
      operationReference: operationReference(),
      registrationId: syntheticRegistrationId,
    })
    const worker = createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog })
    await worker.run(receipt.operationId)
    const stored = (
      await observer.query('SELECT * FROM transactional_email_outbox WHERE id = $1', [receipt.operationId])
    ).rows[0]
    expect(stored).toMatchObject({
      state: 'accepted',
      command_payload: null,
      recipient_address: null,
      prepared_html: null,
      prepared_text: null,
      prepared_subject: null,
      lease_token: null,
    })
    expect(Number(stored.attempt_count)).toBe(1)
    expect(stored.provider_accepted_at).not.toBeNull()
    expect(stored.scrubbed_at).not.toBeNull()
    const events = (
      await observer.query('SELECT type FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence', [
        receipt.operationId,
      ])
    ).rows.map((row) => row.type)
    expect(events).toEqual([
      'command.accepted',
      'lease.acquired',
      'preparation.completed',
      'delivery.attempt-started',
      'delivery.accepted',
      'payload.scrubbed',
    ])
  })

  it('grants exactly one two-minute lease under concurrent claims and rejects stale workers after reclaim', async () => {
    const { req, id } = await accept()
    let clock = Date.now()
    const worker = createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog, now: () => clock })
    const claims = await Promise.all([worker.claim(id), worker.claim(id)])
    expect(claims.filter(Boolean)).toHaveLength(1)
    const original = claims.find(Boolean)!
    const first = await row(id)
    expect(first.lease_expires_at.getTime() - clock).toBe(120000)
    expect(first.lease_token).toMatch(/^[a-f0-9-]{36}$/)
    clock += 120001
    const replacement = await worker.claim(id)
    expect(replacement?.token).not.toBe(original.token)
    const reclaimed = await row(id)
    await worker.processClaim(original)
    expect(await row(id)).toEqual(reclaimed)
    await worker.processClaim(replacement!)
    expect((await row(id)).state).toBe('accepted')
  })

  it.each(['address', 'binding', 'ineligible'] as const)(
    'terminates a changed %s before generating a link or delivering',
    async (change) => {
      const { req, id } = await accept()
      const links = { generate: vi.fn() }
      const delivery = { deliver: vi.fn() }
      const catalog: CommandCatalog = {
        'clinic.registration-received': {
          ...syntheticEmailCatalog['clinic.registration-received']!,
          worker: {
            template: 'synthetic-notification',
            terminalState: 'suppressed',
            revalidate: async () =>
              change === 'ineligible'
                ? null
                : {
                    address: change === 'address' ? 'changed@example.test' : 'recipient@example.test',
                    binding: change === 'binding' ? randomUUID() : syntheticRegistrationId,
                  },
          },
        },
      }
      await createTransactionalEmailWorker(req, { catalog, links, delivery }).run(id)
      const stored = await row(id)
      expect(stored).toMatchObject({
        state: 'suppressed',
        command_payload: null,
        recipient_address: null,
        lease_token: null,
      })
      expect(links.generate).not.toHaveBeenCalled()
      expect(delivery.deliver).not.toHaveBeenCalled()
    },
  )

  it('commits preparation and attempt-started before submitting the exact payload, without holding a transaction', async () => {
    const { req, id } = await accept()
    const logs: unknown[] = []
    const delivery = {
      deliver: vi.fn(async (attempt) => {
        const stored = await row(id)
        expect(stored.state).toBe('prepared')
        expect(Number(stored.attempt_count)).toBe(1)
        expect(attempt).toEqual({
          recipientAddress: stored.recipient_address,
          subject: stored.prepared_subject,
          html: stored.prepared_html,
          text: stored.prepared_text,
          providerIdempotencyKey: stored.provider_idempotency_key,
        })
        expect(stored.prepared_html).toContain('https://example.test/synthetic-action')
        expect(stored.prepared_text).toContain('https://example.test/synthetic-action')
        expect(Object.keys(payload.db.sessions ?? {})).toHaveLength(0)
        const events = await observer.query(
          'SELECT type FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence',
          [id],
        )
        expect(events.rows.at(-1).type).toBe('delivery.attempt-started')
        return { type: 'accepted' as const, messageId: 'fake-message' }
      }),
    }
    const links = {
      generate: async () => {
        expect(Object.keys(payload.db.sessions ?? {})).toHaveLength(0)
        return 'https://example.test/synthetic-action'
      },
    }
    await createTransactionalEmailWorker(req, {
      catalog: syntheticEmailCatalog,
      links,
      delivery,
      log: (event) => logs.push(event),
    }).run(id)
    expect(delivery.deliver).toHaveBeenCalledTimes(1)
    expect(logs).toEqual([
      {
        operationId: id,
        commandType: 'clinic.registration-received',
        attemptNumber: 1,
        outcomeCode: 'fake-accepted',
        environment: 'test',
      },
    ])
    const stored = await row(id)
    const retained = Object.entries(stored)
      .filter(([, value]) => value !== null)
      .map(([key]) => key)
      .sort()
    expect(retained).toEqual(
      [
        'attempt_count',
        'command_type',
        'created_at',
        'delivery_deadline',
        'id',
        'last_attempt_at',
        'latest_event_sequence',
        'operation_reference',
        'prepared_at',
        'provider_accepted_at',
        'provider_idempotency_key',
        'provider_message_id',
        'recipient_digest',
        'runtime_environment',
        'scrubbed_at',
        'state',
        'terminal_at',
        'updated_at',
      ].sort(),
    )
  })

  it('reuses durable prepared content after an unstarted attempt loses its lease budget', async () => {
    const { req, id } = await accept()
    let clock = Date.now()
    let validations = 0
    const links = { generate: vi.fn(async () => 'https://example.test/original') }
    const catalog: CommandCatalog = {
      'clinic.registration-received': {
        ...syntheticEmailCatalog['clinic.registration-received']!,
        worker: {
          ...syntheticEmailCatalog['clinic.registration-received']!.worker!,
          revalidate: async () => {
            if (++validations === 3) clock += 119000
            return { address: 'recipient@example.test', binding: syntheticRegistrationId }
          },
        },
      },
    }
    const worker = createTransactionalEmailWorker(req, { catalog, now: () => clock, links })
    await worker.run(id)
    const prepared = await row(id)
    expect(prepared.state).toBe('prepared')
    expect(Number(prepared.attempt_count)).toBe(0)
    clock += 2000
    const delivery = {
      deliver: vi.fn(async (attempt) => {
        expect(attempt.html).toBe(prepared.prepared_html)
        expect(attempt.text).toBe(prepared.prepared_text)
        expect(attempt.providerIdempotencyKey).toBe(prepared.provider_idempotency_key)
        return { type: 'accepted' as const, messageId: 'fake-reclaimed' }
      }),
    }
    await createTransactionalEmailWorker(req, { catalog, now: () => clock, links, delivery }).run(id)
    expect(links.generate).toHaveBeenCalledTimes(1)
    expect(delivery.deliver).toHaveBeenCalledTimes(1)
    expect((await row(id)).state).toBe('accepted')
  })

  it('rechecks recipient binding after link generation and before delivery', async () => {
    const { req, id } = await accept()
    let valid = true
    const delivery = { deliver: vi.fn() }
    const catalog: CommandCatalog = {
      'clinic.registration-received': {
        ...syntheticEmailCatalog['clinic.registration-received']!,
        worker: {
          ...syntheticEmailCatalog['clinic.registration-received']!.worker!,
          revalidate: async () =>
            valid ? { address: 'recipient@example.test', binding: syntheticRegistrationId } : null,
        },
      },
    }
    await createTransactionalEmailWorker(req, {
      catalog,
      links: {
        generate: async () => {
          valid = false
          return 'https://example.test/action'
        },
      },
      delivery,
    }).run(id)
    expect(delivery.deliver).not.toHaveBeenCalled()
    expect((await row(id)).state).toBe('suppressed')
  })

  it('rolls back acceptance and scrubbing together when the terminal event fails', async () => {
    const { req, id } = await accept()
    const hooks = payload.collections.transactionalEmailEvents.config.hooks.beforeChange
    const fault: CollectionBeforeChangeHook = ({ data }) => {
      if (data.type === 'payload.scrubbed') throw new Error('synthetic terminal fault')
      return data
    }
    hooks.push(fault)
    try {
      await expect(
        createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog }).run(id),
      ).rejects.toMatchObject({ code: 'storage-unavailable' })
    } finally {
      hooks.splice(hooks.indexOf(fault), 1)
    }
    const stored = await row(id)
    expect(stored.state).toBe('prepared')
    expect(stored.recipient_address).toBe('recipient@example.test')
    expect(stored.prepared_html).not.toBeNull()
    expect(stored.provider_accepted_at).toBeNull()
    const events = await observer.query('SELECT type FROM transactional_email_events WHERE outbox_id = $1', [id])
    expect(events.rows.map((event) => event.type)).not.toContain('delivery.accepted')
  })

  it('scrubs preparation failures without logging the raw error', async () => {
    const { req, id } = await accept()
    const log = vi.fn()
    await createTransactionalEmailWorker(req, {
      catalog: syntheticEmailCatalog,
      log,
      links: {
        generate: async () => {
          throw new Error('secret recipient@example.test')
        },
      },
    }).run(id)
    expect(await row(id)).toMatchObject({
      state: 'failed',
      command_payload: null,
      recipient_address: null,
      lease_token: null,
    })
    expect(log).not.toHaveBeenCalled()
  })

  it('rejects an illegal state transition', async () => {
    const { req, id } = await accept()
    const worker = createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog })
    const claim = await worker.claim(id)
    const transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw Error('Expected transaction')
    const capability = openStorageCapability(transactionID, { kind: 'worker', token: claim!.token, now: Date.now })
    try {
      const internalReq = await createLocalReq(
        { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
        payload,
      )
      await expect(
        payload.update({
          collection: 'transactionalEmailOutbox',
          id: Number(id),
          req: internalReq,
          data: { state: 'delivered' },
        }),
      ).rejects.toMatchObject({ code: 'access-denied' })
    } finally {
      capability.close()
      await payload.db.rollbackTransaction(transactionID)
    }
  })

  it.each(['local', 'test', 'ci'])('uses no external network in %s', async (environment) => {
    vi.stubEnv('DEPLOYMENT_ENV', environment)
    vi.stubEnv('NODE_ENV', environment === 'test' ? 'test' : 'development')
    vi.stubEnv('CI', environment === 'ci' ? 'true' : 'false')
    const { req, id } = await accept()
    const deny = () => {
      throw Error('External network forbidden')
    }
    const fetchGuard = vi.spyOn(globalThis, 'fetch').mockImplementation(deny)
    const httpGuard = vi.spyOn(http, 'request').mockImplementation(deny)
    const httpsGuard = vi.spyOn(https, 'request').mockImplementation(deny)
    await createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog }).run(id)
    expect((await row(id)).state).toBe('accepted')
    expect(fetchGuard).not.toHaveBeenCalled()
    expect(httpGuard).not.toHaveBeenCalled()
    expect(httpsGuard).not.toHaveBeenCalled()
  })

  it.each(['preview', 'production'])('fails closed before worker processing in %s', async (environment) => {
    const { req, id } = await accept()
    const original = await row(id)
    vi.stubEnv('DEPLOYMENT_ENV', environment)
    expect(() => createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog })).toThrow(
      'environment-unavailable',
    )
    expect(await row(id)).toEqual(original)
  })

  it('rejects a prepared state without durable message fields', async () => {
    const { req, id } = await accept()
    const claim = await createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog }).claim(id)
    const transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw Error('Expected transaction')
    const capability = openStorageCapability(transactionID, { kind: 'worker', token: claim!.token, now: Date.now })
    try {
      const internalReq = await createLocalReq(
        { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
        payload,
      )
      await expect(
        payload.update({
          collection: 'transactionalEmailOutbox',
          id: Number(id),
          req: internalReq,
          data: { state: 'prepared' },
        }),
      ).rejects.toMatchObject({ code: 'access-denied' })
    } finally {
      capability.close()
      await payload.db.rollbackTransaction(transactionID)
    }
    expect((await row(id)).state).toBe('queued')
  })

  it('allows the current token to prepare but fences the same write after expiry and reclaim', async () => {
    const { req, id } = await accept()
    let clock = Date.now()
    const worker = createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog, now: () => clock })
    const first = await worker.claim(id)
    const prepare = async (token: string) => {
      const transactionID = await payload.db.beginTransaction()
      if (!transactionID) throw Error('Expected transaction')
      const capability = openStorageCapability(transactionID, { kind: 'worker', token, now: () => clock })
      try {
        const internalReq = await createLocalReq(
          { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
          payload,
        )
        await payload.update({
          collection: 'transactionalEmailOutbox',
          id: Number(id),
          req: internalReq,
          depth: 0,
          data: {
            state: 'prepared',
            preparedSubject: 'Synthetic subject',
            preparedHtml: '<p>Synthetic</p>',
            preparedText: 'Synthetic',
            preparedAt: new Date(clock).toISOString(),
          },
        })
        await payload.db.commitTransaction(transactionID)
      } catch (error) {
        await payload.db.rollbackTransaction(transactionID)
        throw error
      } finally {
        capability.close()
      }
    }
    clock += 120001
    const expired = await row(id)
    await expect(prepare(first!.token)).rejects.toMatchObject({ code: 'access-denied' })
    expect(await row(id)).toEqual(expired)
    const second = await worker.claim(id)
    const reclaimed = await row(id)
    const events = async () =>
      (await observer.query('SELECT * FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence', [id]))
        .rows
    const beforeEvents = await events()
    await expect(prepare(first!.token)).rejects.toMatchObject({ code: 'access-denied' })
    expect(await row(id)).toEqual(reclaimed)
    expect(await events()).toEqual(beforeEvents)
    await prepare(second!.token)
    expect(await row(id)).toMatchObject({
      state: 'prepared',
      prepared_subject: 'Synthetic subject',
      lease_token: second!.token,
    })
    expect(await events()).toEqual(beforeEvents)
  })

  it('consumes each worker event permission once', async () => {
    const { req, id } = await accept()
    const hooks = payload.collections.transactionalEmailEvents.config.hooks
    const originalHooks = hooks.afterChange
    let checked = false
    hooks.afterChange = [
      ...(originalHooks ?? []),
      async ({ doc, req: internalReq }) => {
        if (doc.source === 'worker' && !checked) {
          checked = true
          await expect(
            payload.create({
              collection: 'transactionalEmailEvents',
              req: internalReq,
              depth: 0,
              data: { outbox: Number(id), sequence: doc.sequence, type: doc.type, source: 'worker' },
            }),
          ).rejects.toMatchObject({ code: 'access-denied' })
        }
        return doc
      },
    ]
    try {
      expect(await createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog }).claim(id)).not.toBeNull()
    } finally {
      hooks.afterChange = originalHooks
    }
    expect(checked).toBe(true)
    expect(
      (
        await observer.query('SELECT sequence FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence', [
          id,
        ])
      ).rows.map((event) => Number(event.sequence)),
    ).toEqual([1, 2])
  })

  it.each(['outbox', 'sequence'] as const)(
    'rolls back a guarded update when its event targets the wrong %s',
    async (field) => {
      const { req, id } = await accept()
      const foreign = await accept()
      const original = await row(id)
      const beforeEvents = (
        await observer.query('SELECT * FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence', [id])
      ).rows
      const hooks = payload.collections.transactionalEmailEvents.config.hooks
      const originalHooks = hooks.beforeChange
      hooks.beforeChange = [
        ({ data }) => ({ ...data, [field]: field === 'outbox' ? Number(foreign.id) : data.sequence + 1 }),
        ...(originalHooks ?? []),
      ]
      try {
        await expect(
          createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog }).claim(id),
        ).rejects.toMatchObject({ code: 'access-denied' })
      } finally {
        hooks.beforeChange = originalHooks
      }
      expect(await row(id)).toEqual(original)
      expect(
        (await observer.query('SELECT * FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence', [id]))
          .rows,
      ).toEqual(beforeEvents)
    },
  )

  it('rejects worker event appends without a preceding guarded outbox write', async () => {
    const { req, id } = await accept()
    const claim = await createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog }).claim(id)
    const before = (
      await observer.query('SELECT * FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence', [id])
    ).rows
    const transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw Error('Expected transaction')
    const capability = openStorageCapability(transactionID, { kind: 'worker', token: claim!.token, now: Date.now })
    try {
      const internalReq = await createLocalReq(
        { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
        payload,
      )
      await expect(
        payload.create({
          collection: 'transactionalEmailEvents',
          req: internalReq,
          depth: 0,
          data: { outbox: Number(id), sequence: 3, type: 'preparation.completed', source: 'worker' },
        }),
      ).rejects.toMatchObject({ code: 'access-denied' })
    } finally {
      capability.close()
      await payload.db.rollbackTransaction(transactionID)
    }
    expect(
      (await observer.query('SELECT * FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence', [id]))
        .rows,
    ).toEqual(before)
  })

  it('rejects direct writes with stale tokens and prevents lease renewal', async () => {
    const { req, id } = await accept()
    let clock = Date.now()
    const worker = createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog, now: () => clock })
    const first = await worker.claim(id)
    clock += 120001
    const second = await worker.claim(id)
    const original = await row(id)
    for (const token of [first!.token, second!.token]) {
      const transactionID = await payload.db.beginTransaction()
      if (!transactionID) throw Error('Expected transaction')
      const capability = openStorageCapability(transactionID, { kind: 'worker', token, now: () => clock })
      try {
        const internalReq = await createLocalReq(
          { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
          payload,
        )
        await expect(
          payload.update({
            collection: 'transactionalEmailOutbox',
            id: Number(id),
            req: internalReq,
            data: { leaseExpiresAt: new Date(clock + 240000).toISOString() },
          }),
        ).rejects.toMatchObject({ code: 'access-denied' })
      } finally {
        capability.close()
        await payload.db.rollbackTransaction(transactionID)
      }
    }
    expect(await row(id)).toEqual(original)
  })

  it('refuses new preparation with insufficient remaining lease budget', async () => {
    const { req, id } = await accept()
    let clock = Date.now()
    const links = { generate: vi.fn() }
    const worker = createTransactionalEmailWorker(req, { catalog: syntheticEmailCatalog, now: () => clock, links })
    const claim = await worker.claim(id)
    clock += 115000
    await worker.processClaim(claim!)
    expect(links.generate).not.toHaveBeenCalled()
    expect((await row(id)).state).toBe('queued')
  })

  it('preserves prepared bytes against direct rewrites and suppresses changed recipients after reclaim', async () => {
    const { req, id } = await accept()
    let clock = Date.now()
    let calls = 0
    let eligible = true
    const catalog: CommandCatalog = {
      'clinic.registration-received': {
        ...syntheticEmailCatalog['clinic.registration-received']!,
        worker: {
          ...syntheticEmailCatalog['clinic.registration-received']!.worker!,
          revalidate: async () => {
            if (++calls === 3) clock += 119000
            return eligible ? { address: 'recipient@example.test', binding: syntheticRegistrationId } : null
          },
        },
      },
    }
    const delivery = { deliver: vi.fn() }
    const worker = createTransactionalEmailWorker(req, { catalog, now: () => clock, delivery })
    const claim = await worker.claim(id)
    await worker.processClaim(claim!)
    const prepared = await row(id)
    expect(prepared.state).toBe('prepared')
    const transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw Error('Expected transaction')
    const capability = openStorageCapability(transactionID, { kind: 'worker', token: claim!.token, now: () => clock })
    try {
      const internalReq = await createLocalReq(
        { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
        payload,
      )
      await expect(
        payload.update({
          collection: 'transactionalEmailOutbox',
          id: Number(id),
          req: internalReq,
          data: { preparedHtml: 'changed content' },
        }),
      ).rejects.toMatchObject({ code: 'access-denied' })
    } finally {
      capability.close()
      await payload.db.rollbackTransaction(transactionID)
    }
    expect(await row(id)).toEqual(prepared)
    eligible = false
    clock += 2000
    await worker.run(id)
    expect(delivery.deliver).not.toHaveBeenCalled()
    expect(await row(id)).toMatchObject({
      state: 'suppressed',
      prepared_html: null,
      prepared_text: null,
      recipient_address: null,
    })
  })

  it('scrubs permanent fake rejection and retains only a safe outcome event', async () => {
    const { req, id } = await accept()
    const log = vi.fn()
    await createTransactionalEmailWorker(req, {
      catalog: syntheticEmailCatalog,
      log,
      delivery: { deliver: async () => ({ type: 'permanent' }) },
    }).run(id)
    expect(await row(id)).toMatchObject({
      state: 'failed',
      command_payload: null,
      prepared_html: null,
      prepared_text: null,
      recipient_address: null,
      lease_token: null,
    })
    expect(log).toHaveBeenCalledWith({
      operationId: id,
      commandType: 'clinic.registration-received',
      attemptNumber: 1,
      outcomeCode: 'permanent-failure',
      environment: 'test',
    })
    const events = await observer.query(
      'SELECT type, outcome_code FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence',
      [id],
    )
    expect(events.rows.at(-2)).toEqual({ type: 'delivery.failed', outcome_code: 'permanent-failure' })
    expect(JSON.stringify(events.rows)).not.toContain('recipient@example.test')
  })
})
