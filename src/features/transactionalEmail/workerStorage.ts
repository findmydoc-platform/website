import { createLocalReq, type PayloadRequest, type Where } from 'payload'
import type { TransactionalEmailOutbox, TransactionalEmailEvent } from '@/payload-types'
import {
  authorizeRetentionDeletes,
  authorizeEventAppends,
  openStorageCapability,
  type WorkerAuthority,
} from './capability'
import { deletionEligible } from './retentionPolicy'
import { TransactionalEmailError } from './errors'
import { runOwnedTransaction } from './transactions'

type EventData = Pick<TransactionalEmailEvent, 'type'> &
  Partial<Pick<TransactionalEmailEvent, 'attemptNumber' | 'outcomeCode'>>
export type OutboxUpdate = Partial<Omit<TransactionalEmailOutbox, 'id' | 'createdAt' | 'updatedAt'>>

export function workerTransaction<Result>(
  req: PayloadRequest,
  authority: WorkerAuthority,
  work: (storage: {
    read(id: number): Promise<TransactionalEmailOutbox>
    find(where: Where): Promise<TransactionalEmailOutbox[]>
    remove(record: TransactionalEmailOutbox): Promise<void>
    write(record: TransactionalEmailOutbox, data: OutboxUpdate, events: EventData[]): Promise<TransactionalEmailOutbox>
  }) => Promise<Result>,
): Promise<Result> {
  return runOwnedTransaction(req, async (_, transactionID) => {
    const capability = openStorageCapability(transactionID, authority)
    try {
      const internalReq = await createLocalReq(
        { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
        req.payload,
      )
      return await work({
        find: async (where) =>
          (
            await req.payload.find({
              collection: 'transactionalEmailOutbox',
              req: internalReq,
              depth: 0,
              limit: 100,
              sort: 'id',
              where,
            })
          ).docs,
        read: (id) => req.payload.findByID({ collection: 'transactionalEmailOutbox', id, req: internalReq, depth: 0 }),
        async remove(record) {
          if (authority.kind !== 'sweep' || !deletionEligible(record, authority.now()))
            throw new TransactionalEmailError('access-denied')
          const events = await req.payload.find({
            collection: 'transactionalEmailEvents',
            req: internalReq,
            depth: 0,
            pagination: false,
            where: { outbox: { equals: record.id } },
          })
          authorizeRetentionDeletes(
            internalReq,
            record.id,
            events.docs.map((event) => event.id),
          )
          for (const event of events.docs)
            await req.payload.delete({
              collection: 'transactionalEmailEvents',
              id: event.id,
              req: internalReq,
              depth: 0,
            })
          await req.payload.delete({
            collection: 'transactionalEmailOutbox',
            id: record.id,
            req: internalReq,
            depth: 0,
          })
        },
        async write(record, data, events) {
          let sequence = record.latestEventSequence
          const updated = await req.payload.update({
            collection: 'transactionalEmailOutbox',
            id: record.id,
            req: internalReq,
            depth: 0,
            data: { ...data, latestEventSequence: sequence + events.length },
          })
          authorizeEventAppends(
            internalReq,
            record.id,
            events.map((_, index) => sequence + index + 1),
          )
          for (const event of events)
            await req.payload.create({
              collection: 'transactionalEmailEvents',
              req: internalReq,
              depth: 0,
              data: { ...event, source: 'worker', outbox: record.id, sequence: ++sequence },
            })
          return updated
        },
      })
    } finally {
      capability.close()
    }
  })
}
