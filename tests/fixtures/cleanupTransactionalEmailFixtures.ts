import { createLocalReq, type Payload } from 'payload'
import { openStorageCapability } from '@/features/transactionalEmail/capability'
import { runOwnedTransaction } from '@/features/transactionalEmail/transactions'

export async function cleanupTransactionalEmailFixtures(payload: Payload, references: string[]) {
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
  } finally {
    outboxHooks.beforeDelete = originalOutboxDelete
    eventHooks.beforeDelete = originalEventDelete
  }
}
