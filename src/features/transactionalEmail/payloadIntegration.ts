import { createLocalReq, type PayloadRequest } from 'payload'
import activationRegistry from './activationRegistry.json' with { type: 'json' }
import { createCommandPort, type AcceptanceStorage } from './acceptance'
import {
  hasTransactionalEmailActivationForEnvironment,
  isTransactionalEmailCommandActivationDeclared,
} from './activationPolicy'
import type { CommandType } from './commands'
import type { CommandCatalog } from './catalog'
import { bindPayloadCommandCatalog } from './payloadCatalog'
import { openStorageCapability } from './capability'
import {
  resolveTransactionalEmailEnvironment,
  selectTransactionalEmailAcceptanceRuntime,
  selectTransactionalEmailAcceptanceRuntimeForTest,
} from './environment'
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
      async find(commandType, operationReference) {
        const result = await req.payload.find({
          collection: 'transactionalEmailOutbox',
          req: internalReq,
          overrideAccess: true,
          depth: 0,
          limit: 1,
          where: {
            and: [{ commandType: { equals: commandType } }, { operationReference: { equals: operationReference } }],
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
            createdAt: operation.acceptedAt,
            deliveryDeadline: operation.deliveryDeadline,
            commandType: operation.command.type,
            operationReference: operation.operationReference,
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

type AcceptanceRuntime = ReturnType<typeof selectTransactionalEmailAcceptanceRuntime>

function bindTransactionalEmailWithRuntime(
  req: PayloadRequest,
  catalog: CommandCatalog | undefined,
  now: () => number,
  runtime: AcceptanceRuntime,
) {
  return createCommandPort({
    now,
    actor: req.user ? `${req.user.collection}:${req.user.id}` : null,
    catalog: catalog ?? bindPayloadCommandCatalog(req),
    digestRecipient: runtime.digestRecipient,
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

export function bindTransactionalEmail(req: PayloadRequest, catalog?: CommandCatalog, now: () => number = Date.now) {
  return bindTransactionalEmailWithRuntime(req, catalog, now, selectTransactionalEmailAcceptanceRuntime())
}

export function bindTransactionalEmailForTest(
  req: PayloadRequest,
  catalog: CommandCatalog,
  runtimeInput: Parameters<typeof selectTransactionalEmailAcceptanceRuntimeForTest>,
  now: () => number = Date.now,
) {
  if (process.env.VITEST !== 'true') throw new TransactionalEmailError('environment-unavailable')
  return bindTransactionalEmailWithRuntime(
    req,
    catalog,
    now,
    selectTransactionalEmailAcceptanceRuntimeForTest(...runtimeInput),
  )
}

function runTransactionalEmailTransactionWithRuntime<Result>(
  req: PayloadRequest,
  work: (transactionReq: PayloadRequest, commands: TransactionalEmailCommands) => Promise<Result>,
  catalog: CommandCatalog | undefined,
  runtime: AcceptanceRuntime,
): Promise<Result> {
  return runOwnedTransaction(req, (transactionReq) =>
    work(transactionReq, bindTransactionalEmailWithRuntime(transactionReq, catalog, Date.now, runtime)),
  )
}

/** The Website integration owns this outer response boundary and repeats the whole business callback. */
export function runTransactionalEmailTransaction<Result>(
  req: PayloadRequest,
  work: (transactionReq: PayloadRequest, commands: TransactionalEmailCommands) => Promise<Result>,
  catalog?: CommandCatalog,
): Promise<Result> {
  const runtime = selectTransactionalEmailAcceptanceRuntime()
  return runTransactionalEmailTransactionWithRuntime(req, work, catalog, runtime)
}

function selectTransactionalEmailCommandAcceptanceWithRuntime(
  command: CommandType,
  environment: ReturnType<typeof resolveTransactionalEmailEnvironment>,
  activationInput: unknown,
  selectRuntime: () => AcceptanceRuntime,
) {
  if (
    (environment === 'preview' || environment === 'production') &&
    (!hasTransactionalEmailActivationForEnvironment(environment, activationInput) ||
      !isTransactionalEmailCommandActivationDeclared(environment, command, activationInput))
  ) {
    return Object.freeze({ kind: 'inactive' as const })
  }
  const runtime = selectRuntime()
  return Object.freeze({
    kind: 'active' as const,
    run<Result>(
      req: PayloadRequest,
      work: (transactionReq: PayloadRequest, commands: TransactionalEmailCommands) => Promise<Result>,
      catalog?: CommandCatalog,
    ) {
      return runTransactionalEmailTransactionWithRuntime(req, work, catalog, runtime)
    },
  })
}

export function selectTransactionalEmailCommandAcceptance(command: CommandType) {
  return selectTransactionalEmailCommandAcceptanceWithRuntime(
    command,
    resolveTransactionalEmailEnvironment(),
    activationRegistry,
    selectTransactionalEmailAcceptanceRuntime,
  )
}

export function selectTransactionalEmailCommandAcceptanceForTest(
  command: CommandType,
  runtimeInput: Parameters<typeof selectTransactionalEmailAcceptanceRuntimeForTest>,
) {
  if (process.env.VITEST !== 'true') throw new TransactionalEmailError('environment-unavailable')
  return selectTransactionalEmailCommandAcceptanceWithRuntime(
    command,
    resolveTransactionalEmailEnvironment(runtimeInput[0]),
    runtimeInput[4] ?? activationRegistry,
    () => selectTransactionalEmailAcceptanceRuntimeForTest(...runtimeInput),
  )
}
