import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const { closeDeliveryEdgeNetworkBoundary, deliveryEdgeNetworkGuard: networkGuard } = await vi.hoisted(
  () => import('../helpers/deliveryEdgeNetworkBoundary'),
)
import { randomUUID } from 'node:crypto'
import * as emailRenderer from '@react-email/render'
import { createLocalReq, getPayload, type Payload } from 'payload'
import pg from 'pg'
import config from '@payload-config'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import { resolveActivationPolicy } from '@/features/transactionalEmail/activationPolicy'
import { createActivationFixture } from '../fixtures/transactionalEmailActivation'
import {
  clearedSyntheticSuppression,
  syntheticEmailCatalog,
  syntheticRegistrationId,
} from '../fixtures/transactionalEmail'
import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'

vi.mock('@/auth/utilities/jwtValidation', () => ({ extractSupabaseUserData: async () => null }))
vi.mock('@react-email/render', { spy: true })

describe('transactional email activation at the worker boundary', () => {
  let payload: Payload
  let observer: pg.Client
  const references: string[] = []
  beforeAll(async () => {
    expect(networkGuard.isInstalled()).toBe(true)
    payload = await getPayload({ config })
    observer = new pg.Client({ connectionString: process.env.DATABASE_URI })
    await observer.connect()
  }, 60000)
  afterEach(() => {
    try {
      networkGuard.assertNoAttempts()
    } finally {
      vi.clearAllMocks()
      vi.restoreAllMocks()
      vi.unstubAllEnvs()
      networkGuard.reinstall()
      networkGuard.resetAttempts()
    }
  })
  afterAll(async () => {
    try {
      await cleanupTransactionalEmailFixtures(payload, references)
    } finally {
      try {
        await observer?.end()
        networkGuard.assertNoAttempts()
      } finally {
        closeDeliveryEdgeNetworkBoundary()
      }
    }
  })

  it.each(['command-not-enabled', 'preview-recipient-not-allowed'] as const)(
    'records %s atomically before links, rendering, or delivery',
    async (outcomeCode) => {
      vi.stubEnv('CI', 'false')
      const req = await createLocalReq({}, payload)
      const operationReference = randomUUID()
      references.push(operationReference)
      const { operationId } = await bindTransactionalEmail(req, syntheticEmailCatalog).accept({
        type: 'clinic.registration-received',
        operationReference,
        registrationId: syntheticRegistrationId,
      })
      const fixture = createActivationFixture()
      if (outcomeCode === 'command-not-enabled') fixture.registry.records = []
      const links = { generate: vi.fn(async () => 'https://example.test/action') }
      const delivery = { deliver: vi.fn(async () => ({ type: 'accepted' as const, messageId: 'fake-policy' })) }
      const log = vi.fn()
      const render = vi.mocked(emailRenderer.render)
      await createTransactionalEmailWorker(req, {
        suppression: clearedSyntheticSuppression,
        catalog: syntheticEmailCatalog,
        links,
        delivery,
        log,
        activationPolicy: resolveActivationPolicy(fixture.binding, fixture.registry),
      }).run(operationId)
      expect(links.generate).not.toHaveBeenCalled()
      expect(render).not.toHaveBeenCalled()
      expect(delivery.deliver).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalledWith({
        operationId,
        commandType: 'clinic.registration-received',
        environment: 'test',
        outcomeCode,
        outboxState: 'suppressed',
      })
      const stored = (await observer.query('SELECT * FROM transactional_email_outbox WHERE id = $1', [operationId]))
        .rows[0]
      expect(stored).toMatchObject({
        state: 'suppressed',
        command_payload: null,
        recipient_address: null,
        prepared_at: null,
        prepared_subject: null,
        prepared_html: null,
        prepared_text: null,
        attempt_count: '0',
        lease_token: null,
        lease_expires_at: null,
        next_attempt_at: null,
      })
      expect(stored.scrubbed_at).toEqual(stored.terminal_at)
      const events = (
        await observer.query(
          'SELECT type, outcome_code FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence',
          [operationId],
        )
      ).rows
      expect(events).toEqual([
        { type: 'command.accepted', outcome_code: null },
        { type: 'lease.acquired', outcome_code: null },
        { type: 'delivery.suppressed', outcome_code: outcomeCode },
        { type: 'payload.scrubbed', outcome_code: null },
      ])
    },
  )

  it.each(['command-not-enabled', 'preview-recipient-not-allowed'] as const)(
    'rechecks %s before retrying a prepared operation',
    async (outcomeCode) => {
      vi.stubEnv('CI', 'false')
      const req = await createLocalReq({}, payload)
      const operationReference = randomUUID()
      references.push(operationReference)
      const { operationId } = await bindTransactionalEmail(req, syntheticEmailCatalog).accept({
        type: 'clinic.registration-received',
        operationReference,
        registrationId: syntheticRegistrationId,
      })
      let now = Date.now()
      const fixture = createActivationFixture()
      const allowlist = ['digest-preview:b6b9397238db67fdbabcf8b26ff25b27694d3c9e4ae7ce14ddc692cc7bea29cf']
      const links = { generate: vi.fn(async () => 'https://example.test/action') }
      const delivery = { deliver: vi.fn(async () => ({ type: 'retryable' as const })) }
      const render = vi.mocked(emailRenderer.render)
      const options = { catalog: syntheticEmailCatalog, links, delivery, now: () => now }
      await createTransactionalEmailWorker(req, {
        suppression: clearedSyntheticSuppression,
        ...options,
        activationPolicy: resolveActivationPolicy(fixture.binding, fixture.registry, allowlist),
      }).run(operationId)
      const before = (await observer.query('SELECT * FROM transactional_email_outbox WHERE id = $1', [operationId]))
        .rows[0]
      expect(before.state).toBe('prepared')
      expect(before.prepared_html).toContain('A synthetic notification is available.')
      expect(delivery.deliver).toHaveBeenCalledTimes(1)
      expect(render).toHaveBeenCalledTimes(1)
      if (outcomeCode === 'command-not-enabled') fixture.registry.records = []
      else allowlist.length = 0
      now += 60_000
      await createTransactionalEmailWorker(req, {
        suppression: clearedSyntheticSuppression,
        ...options,
        activationPolicy: resolveActivationPolicy(fixture.binding, fixture.registry, allowlist),
      }).run(operationId)
      expect(links.generate).toHaveBeenCalledTimes(1)
      expect(render).toHaveBeenCalledTimes(1)
      expect(delivery.deliver).toHaveBeenCalledTimes(1)
      const after = (await observer.query('SELECT * FROM transactional_email_outbox WHERE id = $1', [operationId]))
        .rows[0]
      expect(after).toMatchObject({
        state: 'suppressed',
        recipient_address: null,
        prepared_html: null,
        prepared_text: null,
        prepared_subject: null,
        attempt_count: '1',
        next_attempt_at: null,
        command_payload: null,
      })
      expect(after.prepared_at).toEqual(before.prepared_at)
      expect(after.scrubbed_at).toEqual(after.terminal_at)
      const events = (
        await observer.query(
          'SELECT type, outcome_code FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence',
          [operationId],
        )
      ).rows
      expect(events.slice(-2)).toEqual([
        { type: 'delivery.suppressed', outcome_code: outcomeCode },
        { type: 'payload.scrubbed', outcome_code: null },
      ])
    },
  )

  it('rolls back suppression and scrubbing together when the audit write fails', async () => {
    vi.stubEnv('CI', 'false')
    const req = await createLocalReq({}, payload)
    const operationReference = randomUUID()
    references.push(operationReference)
    const { operationId } = await bindTransactionalEmail(req, syntheticEmailCatalog).accept({
      type: 'clinic.registration-received',
      operationReference,
      registrationId: syntheticRegistrationId,
    })
    const fixture = createActivationFixture()
    const hooks = payload.collections.transactionalEmailEvents.config.hooks
    const original = hooks.beforeChange
    hooks.beforeChange = [
      ...(original ?? []),
      ({ data }) => {
        if (data.type === 'delivery.suppressed') throw new Error('Synthetic audit failure')
        return data
      },
    ]
    const links = { generate: vi.fn() }
    const delivery = { deliver: vi.fn() }
    try {
      await expect(
        createTransactionalEmailWorker(req, {
          suppression: clearedSyntheticSuppression,
          catalog: syntheticEmailCatalog,
          links,
          delivery,
          activationPolicy: resolveActivationPolicy(fixture.binding, fixture.registry),
        }).run(operationId),
      ).rejects.toMatchObject({ code: 'storage-unavailable' })
    } finally {
      hooks.beforeChange = original
    }
    expect(links.generate).not.toHaveBeenCalled()
    expect(delivery.deliver).not.toHaveBeenCalled()
    const stored = (await observer.query('SELECT * FROM transactional_email_outbox WHERE id = $1', [operationId]))
      .rows[0]
    expect(stored).toMatchObject({
      state: 'queued',
      recipient_address: 'recipient@example.test',
      terminal_at: null,
      scrubbed_at: null,
    })
    const events = (
      await observer.query('SELECT type FROM transactional_email_events WHERE outbox_id = $1 ORDER BY sequence', [
        operationId,
      ])
    ).rows
    expect(events).toEqual([{ type: 'command.accepted' }, { type: 'lease.acquired' }])
  })

  it('refuses policy injection outside the explicit test composition', async () => {
    vi.stubEnv('CI', 'false')
    const req = await createLocalReq({}, payload)
    const fixture = createActivationFixture()
    const activationPolicy = resolveActivationPolicy(fixture.binding, fixture.registry)
    vi.stubEnv('VITEST', 'false')
    expect(() =>
      createTransactionalEmailWorker(req, { suppression: clearedSyntheticSuppression, activationPolicy }),
    ).toThrow('environment-unavailable')
    vi.stubEnv('VITEST', 'true')
    expect(() =>
      createTransactionalEmailWorker(req, {
        suppression: clearedSyntheticSuppression,
        activationPolicy: { evaluate: () => null },
      }),
    ).toThrow('environment-unavailable')
  })
})
