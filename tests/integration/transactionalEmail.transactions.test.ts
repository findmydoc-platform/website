import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import https from 'node:https'
import pg from 'pg'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import {
  bindTransactionalEmail,
  runTransactionalEmailTransaction,
} from '@/features/transactionalEmail/payloadIntegration'
import { openStorageCapability } from '@/features/transactionalEmail/capability'
import { runOwnedTransaction } from '@/features/transactionalEmail/transactions'
import { syntheticEmailCatalog, syntheticRegistrationId } from '../fixtures/transactionalEmail'

vi.mock('@/auth/utilities/jwtValidation', () => ({ extractSupabaseUserData: async () => null }))

describe('transactional email transaction ownership', () => {
  let payload: Payload
  let observer: pg.Client
  const ownedReferences = new Set<string>()
  const commandFor = () => {
    const operationReference = randomUUID()
    ownedReferences.add(operationReference)
    return {
      type: 'clinic.registration-received' as const,
      operationReference,
      registrationId: syntheticRegistrationId,
    }
  }
  const cleanupFixtures = async () => {
    if (!payload || !ownedReferences.size) return
    const references = [...ownedReferences]
    const outboxHooks = payload.collections.transactionalEmailOutbox.config.hooks
    const eventHooks = payload.collections.transactionalEmailEvents.config.hooks
    const originalOutboxDelete = outboxHooks.beforeDelete
    const originalEventDelete = eventHooks.beforeDelete
    // Only this disposable-test teardown may delete its own synthetic private records.
    // Runtime denial stays unchanged; restore exact hook arrays even when cleanup fails.
    outboxHooks.beforeDelete = []
    eventHooks.beforeDelete = []
    try {
      await runOwnedTransaction(await createLocalReq({}, payload), async (_, transactionID) => {
        const capability = openStorageCapability(transactionID)
        try {
          const req = await createLocalReq(
            { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
            payload,
          )
          const outbox = await payload.find({
            collection: 'transactionalEmailOutbox',
            req,
            overrideAccess: true,
            depth: 0,
            limit: 100,
            where: { operationReference: { in: references } },
          })
          const ids = outbox.docs.map((record) => record.id)
          if (ids.length) {
            const deletedEvents = await payload.delete({
              collection: 'transactionalEmailEvents',
              req,
              overrideAccess: true,
              depth: 0,
              where: { outbox: { in: ids } },
            })
            if (deletedEvents.errors.length) throw new Error('Synthetic event cleanup failed')
            const deletedOutbox = await payload.delete({
              collection: 'transactionalEmailOutbox',
              req,
              overrideAccess: true,
              depth: 0,
              where: { id: { in: ids } },
            })
            if (deletedOutbox.errors.length) throw new Error('Synthetic outbox cleanup failed')
          }
          const deletedCountries = await payload.delete({
            collection: 'countries',
            req,
            overrideAccess: true,
            depth: 0,
            where: { and: [{ name: { in: references } }, { isoCode: { equals: 'ZZ' } }] },
          })
          if (deletedCountries.errors.length) throw new Error('Synthetic country cleanup failed')
        } finally {
          capability.close()
        }
      })
      for (const reference of references)
        expect(await persisted(reference)).toEqual({ business: 0, outbox: 0, events: 0 })
      ownedReferences.clear()
    } finally {
      outboxHooks.beforeDelete = originalOutboxDelete
      eventHooks.beforeDelete = originalEventDelete
    }
  }
  const persisted = async (reference: string) => {
    const result = await observer.query(
      `SELECT (SELECT count(*)::int FROM countries WHERE name = $1) AS business,
        (SELECT count(*)::int FROM transactional_email_outbox WHERE operation_reference = $1) AS outbox,
        (SELECT count(*)::int FROM transactional_email_events e JOIN transactional_email_outbox o
          ON o.id = e.outbox_id WHERE o.operation_reference = $1) AS events`,
      [reference],
    )
    return result.rows[0]
  }
  const mutate = (req: PayloadRequest, reference: string) =>
    payload.create({
      collection: 'countries',
      req,
      overrideAccess: true,
      data: { name: reference, isoCode: 'ZZ', language: 'test', currency: 'TST' },
    })
  beforeAll(async () => {
    payload = await getPayload({ config })
    observer = new pg.Client({ connectionString: process.env.DATABASE_URI })
    await observer.connect()
  }, 60000)
  beforeEach(() => {
    const denied = () => {
      throw new Error('External network forbidden during mail transaction')
    }
    vi.stubGlobal('fetch', vi.fn(denied))
    vi.spyOn(http, 'request').mockImplementation(denied)
    vi.spyOn(https, 'request').mockImplementation(denied)
    vi.spyOn(http, 'get').mockImplementation(denied)
    vi.spyOn(https, 'get').mockImplementation(denied)
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    await cleanupFixtures()
  })
  afterAll(async () => {
    try {
      await cleanupFixtures()
    } finally {
      await observer?.end()
    }
  })

  it.each(['commit', 'rollback'] as const)(
    'joins the caller transaction and leaves %s to its owner',
    async (outcome) => {
      const transactionID = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
      if (transactionID === null) throw new Error('Test transaction unavailable')
      const req = await createLocalReq({ req: { transactionID } }, payload)
      const command = commandFor()
      const commit = vi.spyOn(payload.db, 'commitTransaction')
      const rollback = vi.spyOn(payload.db, 'rollbackTransaction')
      try {
        await mutate(req, command.operationReference)
        const receipt = await bindTransactionalEmail(req, syntheticEmailCatalog).accept(command)
        expect(receipt.deduplicated).toBe(false)
        expect(commit).not.toHaveBeenCalled()
        expect(rollback).not.toHaveBeenCalled()
        expect(req.transactionID).toBe(transactionID)
        expect(await persisted(command.operationReference)).toEqual({ business: 0, outbox: 0, events: 0 })
        await payload.db[outcome === 'commit' ? 'commitTransaction' : 'rollbackTransaction'](transactionID)
        expect(await persisted(command.operationReference)).toEqual(
          outcome === 'commit' ? { business: 1, outbox: 1, events: 1 } : { business: 0, outbox: 0, events: 0 },
        )
      } finally {
        await payload.db.rollbackTransaction(transactionID)
      }
    },
  )

  it('leaves rollback to the owner after a native Payload write failure', async () => {
    const transactionID = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
    if (transactionID === null) throw new Error('Test transaction unavailable')
    const req = await createLocalReq({ req: { transactionID } }, payload)
    const command = commandFor()
    const hooks = payload.collections.transactionalEmailEvents.config.hooks.beforeChange
    const fail = () => {
      throw new Error('synthetic write failure')
    }
    hooks.push(fail)
    const rollback = vi.spyOn(payload.db, 'rollbackTransaction')
    try {
      await mutate(req, command.operationReference)
      await expect(bindTransactionalEmail(req, syntheticEmailCatalog).accept(command)).rejects.toMatchObject({
        code: 'storage-unavailable',
      })
      expect(rollback).not.toHaveBeenCalled()
      expect(req.transactionID).toBe(transactionID)
      expect(await persisted(command.operationReference)).toEqual({ business: 0, outbox: 0, events: 0 })
      const scopedMutation = await payload.find({
        collection: 'countries',
        req,
        where: { name: { equals: command.operationReference } },
      })
      expect(scopedMutation.docs).toHaveLength(1)
    } finally {
      hooks.splice(hooks.indexOf(fail), 1)
      await payload.db.rollbackTransaction(transactionID)
    }
    expect(await persisted(command.operationReference)).toEqual({ business: 0, outbox: 0, events: 0 })
  })

  it.each(['commit', 'rollback'] as const)(
    'holds the outer response until the complete business transaction can %s',
    async (outcome) => {
      const req = await createLocalReq({}, payload)
      const command = commandFor()
      let release!: () => void
      let reached!: () => void
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      const ready = new Promise<void>((resolve) => {
        reached = resolve
      })
      if (outcome === 'commit') {
        const commit = payload.db.commitTransaction.bind(payload.db)
        vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (id) => {
          reached()
          await held
          return commit(id)
        })
      }
      let succeeded = false
      const response = runTransactionalEmailTransaction(
        req,
        async (transactionReq, commands) => {
          await mutate(transactionReq, command.operationReference)
          const scopedReceipt = await commands.accept(command)
          if (outcome === 'rollback') {
            reached()
            await held
            throw new Error('synthetic domain failure')
          }
          return scopedReceipt
        },
        syntheticEmailCatalog,
      ).then(
        (receipt) => {
          succeeded = true
          return { receipt }
        },
        (error) => ({ error }),
      )
      await ready
      try {
        expect(succeeded).toBe(false)
        expect(await persisted(command.operationReference)).toEqual({ business: 0, outbox: 0, events: 0 })
      } finally {
        release()
      }
      const result = await response
      expect(succeeded).toBe(outcome === 'commit')
      expect(result).toMatchObject(
        outcome === 'commit' ? { receipt: { deduplicated: false } } : { error: { code: 'storage-unavailable' } },
      )
      expect(await persisted(command.operationReference)).toEqual(
        outcome === 'commit' ? { business: 1, outbox: 1, events: 1 } : { business: 0, outbox: 0, events: 0 },
      )
      expect(req.transactionID).toBeUndefined()
    },
  )

  it('deduplicates concurrent standalone commands after a complete transaction retry', async () => {
    const command = commandFor()
    let bothWriting!: () => void
    const ready = new Promise<void>((resolve) => {
      bothWriting = resolve
    })
    let writes = 0
    const hooks = payload.collections.transactionalEmailOutbox.config.hooks.beforeChange
    const synchronize: (typeof hooks)[number] = async ({ data }) => {
      if (data.operationReference === command.operationReference) {
        writes++
        if (writes === 2) bothWriting()
        await ready
      }
      return data
    }
    hooks.push(synchronize)
    try {
      const first = bindTransactionalEmail(await createLocalReq({}, payload), syntheticEmailCatalog)
      const second = bindTransactionalEmail(await createLocalReq({}, payload), syntheticEmailCatalog)
      const receipts = await Promise.all([first.accept(command), second.accept(command)])
      expect(receipts[0].operationId).toBe(receipts[1].operationId)
      expect(receipts[0].acceptedAt).toBe(receipts[1].acceptedAt)
      expect(receipts.map((receipt) => receipt.deduplicated).sort()).toEqual([false, true])
      expect(writes).toBe(2)
      expect(await persisted(command.operationReference)).toEqual({ business: 0, outbox: 1, events: 1 })
    } finally {
      hooks.splice(hooks.indexOf(synchronize), 1)
    }
  })

  it.each(['read committed', 'serializable'] as const)(
    'returns a typed conflict to the losing %s owner without controlling its transaction',
    async (isolationLevel) => {
      const command = commandFor()
      const transactionIDs = await Promise.all([
        payload.db.beginTransaction({ isolationLevel }),
        payload.db.beginTransaction({ isolationLevel }),
      ])
      const requests = await Promise.all(
        transactionIDs.map((transactionID) => {
          if (transactionID === null) throw new Error('Test transaction unavailable')
          return createLocalReq({ req: { transactionID } }, payload)
        }),
      )
      let bothWriting!: () => void
      const ready = new Promise<void>((resolve) => {
        bothWriting = resolve
      })
      let writes = 0
      const hooks = payload.collections.transactionalEmailOutbox.config.hooks.beforeChange
      const synchronize: (typeof hooks)[number] = async ({ data }) => {
        if (data.operationReference === command.operationReference) {
          writes++
          if (writes === 2) bothWriting()
          await ready
        }
        return data
      }
      hooks.push(synchronize)
      const rollback = vi.spyOn(payload.db, 'rollbackTransaction')
      try {
        const outcomes = await Promise.all(
          requests.map(async (req) => {
            await mutate(req, command.operationReference)
            try {
              const receipt = await bindTransactionalEmail(req, syntheticEmailCatalog).accept(command)
              await payload.db.commitTransaction(req.transactionID!)
              return { receipt, req }
            } catch (error) {
              return { error, req }
            }
          }),
        )
        const winner = outcomes.find((result) => 'receipt' in result)
        const loser = outcomes.find((result) => 'error' in result)
        expect(winner).toBeDefined()
        expect(loser).toMatchObject({ error: { code: 'transaction-conflict' } })
        expect(rollback).not.toHaveBeenCalled()
        expect(await persisted(command.operationReference)).toEqual({ business: 1, outbox: 1, events: 1 })
        await payload.db.rollbackTransaction(loser!.req.transactionID!)
        const retried = await runTransactionalEmailTransaction(
          await createLocalReq({}, payload),
          async (req, commands) => {
            await mutate(req, command.operationReference)
            return commands.accept(command)
          },
          syntheticEmailCatalog,
        )
        expect(retried).toEqual({ ...winner!.receipt, deduplicated: true })
        expect(await persisted(command.operationReference)).toEqual({ business: 2, outbox: 1, events: 1 })
      } finally {
        hooks.splice(hooks.indexOf(synchronize), 1)
        for (const transactionID of transactionIDs) {
          if (transactionID !== null) await payload.db.rollbackTransaction(transactionID)
        }
      }
    },
  )

  it.each([0, '', 'missing-session'])(
    'rejects inactive caller transaction %j without autocommit writes',
    async (transactionID) => {
      const req = await createLocalReq({ req: { transactionID } }, payload)
      const command = commandFor()
      await expect(bindTransactionalEmail(req, syntheticEmailCatalog).accept(command)).rejects.toMatchObject({
        code: 'storage-unavailable',
      })
      expect(await persisted(command.operationReference)).toEqual({ business: 0, outbox: 0, events: 0 })
    },
  )

  it('maps a failed pending caller transaction to a content-free storage error', async () => {
    const req = await createLocalReq({}, payload)
    req.transactionID = Promise.reject(new Error('synthetic private adapter detail'))
    const command = commandFor()
    await expect(bindTransactionalEmail(req, syntheticEmailCatalog).accept(command)).rejects.toMatchObject({
      code: 'storage-unavailable',
      message: 'storage-unavailable',
    })
    expect(await persisted(command.operationReference)).toEqual({ business: 0, outbox: 0, events: 0 })
  })

  it('rejects a session closed during authorization before it can escape into autocommit', async () => {
    const transactionID = await payload.db.beginTransaction()
    if (transactionID === null) throw new Error('Test transaction unavailable')
    const req = await createLocalReq({ req: { transactionID } }, payload)
    const command = commandFor()
    const commands = bindTransactionalEmail(req, {
      'clinic.registration-received': {
        authorizeAndResolve: async () => {
          await payload.db.rollbackTransaction(transactionID)
          return { address: 'recipient@example.test', binding: command.registrationId }
        },
      },
    })
    await expect(commands.accept(command)).rejects.toMatchObject({ code: 'access-denied' })
    expect(await persisted(command.operationReference)).toEqual({ business: 0, outbox: 0, events: 0 })
  })

  it.each([1, 3])(
    'repeats the entire business transaction for a real commit conflict, bounded at three attempts (%i faults)',
    async (failures) => {
      const command = commandFor()
      await observer.query('CREATE SEQUENCE mail_business_attempt')
      await observer.query(`CREATE FUNCTION mail_business_commit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF nextval('mail_business_attempt') <= ${failures} THEN
          RAISE EXCEPTION 'synthetic commit conflict' USING ERRCODE = '40001';
        END IF;
        RETURN NEW;
      END;
    $$`)
      await observer.query(`CREATE CONSTRAINT TRIGGER mail_business_commit_failure
      AFTER INSERT ON transactional_email_events DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION mail_business_commit_failure()`)
      let attempts = 0
      try {
        const response = runTransactionalEmailTransaction(
          await createLocalReq({}, payload),
          async (req, commands) => {
            attempts++
            await mutate(req, command.operationReference)
            return commands.accept(command)
          },
          syntheticEmailCatalog,
        )
        if (failures === 1) {
          await expect(response).resolves.toMatchObject({ deduplicated: false })
          expect(attempts).toBe(2)
          expect(await persisted(command.operationReference)).toEqual({ business: 1, outbox: 1, events: 1 })
        } else {
          await expect(response).rejects.toMatchObject({ code: 'transaction-conflict' })
          expect(attempts).toBe(3)
          expect(await persisted(command.operationReference)).toEqual({ business: 0, outbox: 0, events: 0 })
        }
      } finally {
        await observer.query('DROP TRIGGER mail_business_commit_failure ON transactional_email_events')
        await observer.query('DROP FUNCTION mail_business_commit_failure()')
        await observer.query('DROP SEQUENCE mail_business_attempt')
      }
    },
  )

  it('authorizes every joined duplicate before reading its receipt and rolls back the domain mutation on denial', async () => {
    const existing = commandFor()
    await bindTransactionalEmail(await createLocalReq({}, payload), syntheticEmailCatalog).accept(existing)
    for (const command of [existing, commandFor()]) {
      const req = await createLocalReq({}, payload)
      req.user = { id: 1000000001, collection: 'platformStaff' } as NonNullable<typeof req.user>
      const read = vi.spyOn(payload, 'find')
      await expect(
        runTransactionalEmailTransaction(
          req,
          async (transactionReq, commands) => {
            await mutate(transactionReq, command.operationReference)
            return commands.accept(command)
          },
          syntheticEmailCatalog,
        ),
      ).rejects.toMatchObject({ code: 'access-denied', message: 'access-denied' })
      expect(read.mock.calls.filter(([options]) => options.collection === 'transactionalEmailOutbox')).toHaveLength(0)
      read.mockRestore()
      expect(await persisted(command.operationReference)).toEqual(
        command === existing ? { business: 0, outbox: 1, events: 1 } : { business: 0, outbox: 0, events: 0 },
      )
    }
  })
})
