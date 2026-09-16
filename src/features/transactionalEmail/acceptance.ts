import { recipientDigest } from './recipientBinding'
import { randomUUID } from 'node:crypto'
import type { TransactionalEmailAcceptance, TransactionalEmailCommands } from './index'
import { validateCommand, type TransactionalEmailCommand } from './commands'
import { resolveCatalogEntry, type CommandCatalog } from './catalog'
import { TransactionalEmailError } from './errors'
import type { EmailEnvironment } from './environment'

export type AcceptedOperation = { id: number | string; createdAt: string }
export type NewOperation = {
  command: TransactionalEmailCommand
  acceptedAt: string
  deliveryDeadline: string
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
  now?: () => number
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
        const acceptedAt = new Date((dependencies.now ?? Date.now)()).toISOString()
        let deadline = Date.parse(acceptedAt) + 86_400_000
        if (command.type.startsWith('auth.')) {
          const validity = await entry.authValidity?.(command)
          if (
            !validity ||
            !Number.isFinite(Date.parse(validity.actionAt)) ||
            !Number.isFinite(validity.lifetimeMilliseconds) ||
            validity.lifetimeMilliseconds <= 300_000
          ) {
            throw new TransactionalEmailError('invalid-command')
          }
          deadline = Date.parse(validity.actionAt) + validity.lifetimeMilliseconds - 300_000
        }
        const operation = await storage.create({
          command,
          acceptedAt,
          deliveryDeadline: new Date(deadline).toISOString(),
          recipientAddress: recipient.address,
          recipientDigest: recipientDigest(recipient),
          providerIdempotencyKey: randomUUID(),
          runtimeEnvironment: dependencies.environment,
        })
        return { operationId: String(operation.id), acceptedAt: operation.createdAt, deduplicated: false }
      })
    },
  }
}
