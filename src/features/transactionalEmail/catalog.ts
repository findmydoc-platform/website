import type { PreparedMessage, LinkGenerator } from './preparation'
import { renderClinicRegistrationReceipt } from './preparation'
import type { CommandType, TransactionalEmailCommand } from './commands'
import { TransactionalEmailError } from './errors'

export type RecipientBinding = Readonly<{
  address: string
  binding: string
  prepare?(links: LinkGenerator): Promise<PreparedMessage>
}>
export type ClinicApplicationSource = Readonly<{
  id: number
  clinicName: string
  contactEmail: string
  contactFirstName?: string | null
  contactLastName: string
}>
export type CatalogEntry<Command extends TransactionalEmailCommand = TransactionalEmailCommand> = {
  authValidity?(command: Command): Promise<{ actionAt: string; lifetimeMilliseconds: number }>
  isRecipientAllowed?(recipient: RecipientBinding): boolean
  worker?: {
    revalidate(command: Command): Promise<RecipientBinding | null>
    terminalState: 'suppressed' | 'failed'
  }
  authorizeAndResolve(command: Command, actor: string | null): Promise<RecipientBinding>
}
export type CommandCatalog = {
  readonly [Type in CommandType]?: CatalogEntry<Extract<TransactionalEmailCommand, { type: Type }>>
}

function clinicRegistrationRecipient(source: ClinicApplicationSource): RecipientBinding | null {
  const fullName = [source.contactFirstName, source.contactLastName].filter(Boolean).join(' ').trim()
  const clinicName = source.clinicName.trim()
  const address = source.contactEmail.trim()
  if (!fullName || !clinicName || !address) return null
  return {
    address,
    // The digest binds the exact recipient and rendered package props without storing a snapshot.
    binding: JSON.stringify([source.id, fullName, clinicName]),
    prepare: async () => renderClinicRegistrationReceipt(address, { fullName, clinicName }),
  }
}

export function createCommandCatalog(sources: {
  findClinicApplication(id: number): Promise<ClinicApplicationSource | null>
}): CommandCatalog {
  async function loadClinicRegistrationRecipient(
    command: Extract<TransactionalEmailCommand, { type: 'clinic.registration-received' }>,
  ): Promise<RecipientBinding | null> {
    const source = await sources.findClinicApplication(command.registrationId)
    return source ? clinicRegistrationRecipient(source) : null
  }

  return Object.freeze({
    'clinic.registration-received': {
      isRecipientAllowed: () => true,
      async authorizeAndResolve(command, actor) {
        if (actor !== null) throw new TransactionalEmailError('access-denied')
        const recipient = await loadClinicRegistrationRecipient(command)
        if (!recipient) throw new TransactionalEmailError('source-missing')
        return recipient
      },
      worker: {
        revalidate: loadClinicRegistrationRecipient,
        terminalState: 'failed',
      },
    },
  })
}

export function resolveCatalogEntry(catalog: CommandCatalog, command: TransactionalEmailCommand): CatalogEntry {
  const entry = catalog[command.type]
  if (!entry) throw new TransactionalEmailError('unsupported-command')
  return entry as CatalogEntry
}
