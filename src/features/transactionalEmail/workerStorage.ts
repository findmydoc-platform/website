import { createLocalReq, type PayloadRequest } from 'payload'
import type { TransactionalEmailOutbox, TransactionalEmailEvent } from '@/payload-types'
import { authorizeWorkerEventAppends, openStorageCapability, type WorkerAuthority } from './capability'
import { runOwnedTransaction } from './transactions'

type EventData = Pick<TransactionalEmailEvent, 'type'> &
  Partial<Pick<TransactionalEmailEvent, 'attemptNumber' | 'outcomeCode'>>
export type OutboxUpdate = Partial<Omit<TransactionalEmailOutbox, 'id' | 'createdAt' | 'updatedAt'>>

export function workerTransaction<Result>(
  req: PayloadRequest,
  authority: WorkerAuthority,
  work: (storage: {
    read(id: number): Promise<TransactionalEmailOutbox>
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
        read: (id) => req.payload.findByID({ collection: 'transactionalEmailOutbox', id, req: internalReq, depth: 0 }),
        async write(record, data, events) {
          let sequence = record.latestEventSequence
          const updated = await req.payload.update({
            collection: 'transactionalEmailOutbox',
            id: record.id,
            req: internalReq,
            depth: 0,
            data: { ...data, latestEventSequence: sequence + events.length },
          })
          authorizeWorkerEventAppends(
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
