import type { CommandType, TransactionalEmailCommand } from './commands'
import { TransactionalEmailError } from './errors'

export type RecipientBinding = { address: string; binding: string }
export type CatalogEntry<Command extends TransactionalEmailCommand = TransactionalEmailCommand> = {
  authorizeAndResolve(command: Command, actor: string | null): Promise<RecipientBinding>
}
export type CommandCatalog = {
  readonly [Type in CommandType]?: CatalogEntry<Extract<TransactionalEmailCommand, { type: Type }>>
}

// Real registrations require their owning product-flow issue. Test composition supplies a static synthetic catalog.
export const commandCatalog: CommandCatalog = Object.freeze({})

export function resolveCatalogEntry(catalog: CommandCatalog, command: TransactionalEmailCommand): CatalogEntry {
  const entry = catalog[command.type]
  if (!entry) throw new TransactionalEmailError('unsupported-command')
  return entry as CatalogEntry
}
