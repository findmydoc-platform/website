import { createLocalReq, type PayloadRequest } from 'payload'
import { createCommandPort, type AcceptanceStorage } from './acceptance'
import { commandCatalog, type CommandCatalog } from './catalog'
import { openStorageCapability } from './capability'
import { selectTransactionalEmailRuntime } from './environment'
import { TransactionalEmailError } from './errors'

const maximumTransactionAttempts = 3

function retryable(error: unknown): boolean {
  const visited = new Set<unknown>()
  let current = error
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current)
    const detail = current as Record<string, unknown>
    if (detail.code === '40001' || detail.code === '40P01') return true
    if (detail.code === '23505' && detail.constraint === 'commandType_operationReference_idx') return true
    current = detail.cause
  }
  return false
}

export function bindTransactionalEmail(req: PayloadRequest, catalog: CommandCatalog = commandCatalog) {
  const runtime = selectTransactionalEmailRuntime()
  return createCommandPort({
    actor: req.user ? `${req.user.collection}:${req.user.id}` : null,
    catalog,
    environment: runtime.environment,
    async transaction(work) {
      if (typeof req.transactionID !== 'undefined') throw new TransactionalEmailError('storage-unavailable')
      for (let attempt = 1; attempt <= maximumTransactionAttempts; attempt++) {
        let transactionID: number | string | null = null
        let capability: ReturnType<typeof openStorageCapability> | undefined
        try {
          transactionID = await req.payload.db.beginTransaction({
            accessMode: 'read write',
            isolationLevel: 'serializable',
          })
          if (transactionID === null) throw new TransactionalEmailError('storage-unavailable')
          capability = openStorageCapability(transactionID)
          const internalReq = await createLocalReq(
            { context: capability.context, user: req.user ?? undefined, req: { transactionID } },
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
          const result = await work(storage)
          await req.payload.db.commitTransaction(transactionID)
          return result
        } catch (error: unknown) {
          if (transactionID !== null) {
            try {
              await req.payload.db.rollbackTransaction(transactionID)
            } catch {
              throw new TransactionalEmailError('storage-unavailable')
            }
          }
          if (retryable(error)) {
            if (attempt < maximumTransactionAttempts) continue
            throw new TransactionalEmailError('transaction-conflict')
          }
          if (error instanceof TransactionalEmailError) throw error
          throw new TransactionalEmailError('storage-unavailable')
        } finally {
          capability?.close()
        }
      }
      throw new TransactionalEmailError('transaction-conflict')
    },
  })
}
