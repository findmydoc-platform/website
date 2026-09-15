import { createLocalReq, type PayloadRequest } from 'payload'
import { createCommandPort, type AcceptanceStorage } from './acceptance'
import { commandCatalog, type CommandCatalog } from './catalog'
import { openStorageCapability } from './capability'
import { selectTransactionalEmailRuntime } from './environment'
import { TransactionalEmailError } from './errors'
import { isActiveTransaction, runOwnedTransaction, transactionError } from './transactions'
import type { TransactionalEmailCommands } from './index'

async function withStorage<Result>(
  req: PayloadRequest,
  transactionID: number | string,
  work: (storage: AcceptanceStorage) => Promise<Result>,
): Promise<Result> {
  if (!isActiveTransaction(req, transactionID)) throw new TransactionalEmailError('storage-unavailable')
  const capability = openStorageCapability(transactionID)
  try {
    // Payload treats a promise-valued transaction ID as borrowed and leaves rollback to its owner.
    const internalReq = await createLocalReq(
      {
        context: capability.context,
        user: req.user ?? undefined,
        req: { transactionID: Promise.resolve(transactionID) },
      },
      req.payload,
    )
    const storage: AcceptanceStorage = {
      async find(command) {
        const result = await req.payload.find({
          collection: 'transactionalEmailOutbox',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          limit: 1,
          where: {
            and: [
              { commandType: { equals: command.type } },
              { operationReference: { equals: command.operationReference } },
            ],
          },
        })
        return result.docs[0] ?? null
      },
      async create(operation) {
        const outbox = await req.payload.create({
          collection: 'transactionalEmailOutbox',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          data: {
            commandType: operation.command.type,
            operationReference: operation.command.operationReference,
            commandPayload: operation.command,
            recipientAddress: operation.recipientAddress,
            recipientDigest: operation.recipientDigest,
            providerIdempotencyKey: operation.providerIdempotencyKey,
            runtimeEnvironment: operation.runtimeEnvironment,
            state: 'queued',
            latestEventSequence: 1,
          },
        })
        await req.payload.create({
          collection: 'transactionalEmailEvents',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          data: { outbox: outbox.id, sequence: 1, type: 'command.accepted', source: 'command' },
        })
        return outbox
      },
    }
    return await work(storage)
  } catch (error) {
    throw transactionError(error)
  } finally {
    capability.close()
  }
}

export function bindTransactionalEmail(req: PayloadRequest, catalog: CommandCatalog = commandCatalog) {
  const runtime = selectTransactionalEmailRuntime()
  return createCommandPort({
    actor: req.user ? `${req.user.collection}:${req.user.id}` : null,
    catalog,
    environment: runtime.environment,
    async transaction(work) {
      if (typeof req.transactionID !== 'undefined') {
        try {
          const transactionID = await req.transactionID
          if (!isActiveTransaction(req, transactionID)) throw new TransactionalEmailError('storage-unavailable')
          return await withStorage(req, transactionID, work)
        } catch (error) {
          throw transactionError(error)
        }
      }
      return runOwnedTransaction(req, (transactionReq, transactionID) =>
        withStorage(transactionReq, transactionID, work),
      )
    },
  })
}

/** The Website integration owns this outer response boundary and repeats the whole business callback. */
export function runTransactionalEmailTransaction<Result>(
  req: PayloadRequest,
  work: (transactionReq: PayloadRequest, commands: TransactionalEmailCommands) => Promise<Result>,
  catalog: CommandCatalog = commandCatalog,
): Promise<Result> {
  selectTransactionalEmailRuntime()
  return runOwnedTransaction(req, (transactionReq) =>
    work(transactionReq, bindTransactionalEmail(transactionReq, catalog)),
  )
}
