import { createHmac, randomUUID } from 'node:crypto'
import type { TransactionalEmailAcceptance, TransactionalEmailCommands } from './index'
import { validateCommand, type TransactionalEmailCommand } from './commands'
import { resolveCatalogEntry, type CommandCatalog } from './catalog'
import { TransactionalEmailError } from './errors'
import type { EmailEnvironment } from './environment'

export type AcceptedOperation = { id: number | string; createdAt: string }
export type NewOperation = {
  command: TransactionalEmailCommand
  recipientAddress: string
  recipientDigest: string
  providerIdempotencyKey: string
  runtimeEnvironment: EmailEnvironment
}
export type AcceptanceStorage = {
  find(command: TransactionalEmailCommand): Promise<AcceptedOperation | null>
  create(operation: NewOperation): Promise<AcceptedOperation>
}
export type AcceptanceDependencies = {
  actor: string | null
  catalog: CommandCatalog
  environment: EmailEnvironment
  transaction<Result>(work: (storage: AcceptanceStorage) => Promise<Result>): Promise<Result>
}

export function createCommandPort(dependencies: AcceptanceDependencies): TransactionalEmailCommands {
  return {
    async accept(input) {
      const command = validateCommand(input)
      const entry = resolveCatalogEntry(dependencies.catalog, command)
      return dependencies.transaction(async (storage): Promise<TransactionalEmailAcceptance> => {
        const recipient = await entry.authorizeAndResolve(command, dependencies.actor)
        if (!recipient.address.endsWith('@example.test') || !recipient.binding) {
          throw new TransactionalEmailError('invalid-command')
        }
        const existing = await storage.find(command)
        if (existing) return { operationId: String(existing.id), acceptedAt: existing.createdAt, deduplicated: true }
        const operation = await storage.create({
          command,
          recipientAddress: recipient.address,
          recipientDigest: `fake-v1:${createHmac('sha256', 'synthetic-mail-binding-key')
            .update(JSON.stringify([recipient.binding, recipient.address]))
            .digest('hex')}`,
          providerIdempotencyKey: randomUUID(),
          runtimeEnvironment: dependencies.environment,
        })
        return { operationId: String(operation.id), acceptedAt: operation.createdAt, deduplicated: false }
      })
    },
  }
}
