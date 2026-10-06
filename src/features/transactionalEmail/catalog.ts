import type { PreparedMessage } from './preparation'
import { renderClinicRegistrationReceipt } from './preparation'
import type { CommandType, TransactionalEmailCommand } from './commands'
import { TransactionalEmailError } from './errors'

export type RecipientBinding = Readonly<{
  address: string
  binding: string
}>
export type CatalogSuppressionOutcome = 'ineligible' | 'source-unavailable' | 'superseded'
export type SuppressedRecipientBinding = Readonly<{
  status: 'suppressed'
  binding: string
  outcomeCode: CatalogSuppressionOutcome | 'recipient-changed'
}>
export type CatalogAcceptance = RecipientBinding | SuppressedRecipientBinding
export type EligibleCatalogPreparation = Readonly<{
  status: 'eligible'
  recipient: RecipientBinding
  prepare(): Promise<PreparedMessage>
}>
export type CatalogPreparationDecision =
  | EligibleCatalogPreparation
  | Readonly<{ status: 'suppressed'; outcomeCode: CatalogSuppressionOutcome | 'recipient-changed' }>
export type CatalogRevalidation =
  | EligibleCatalogPreparation
  | Readonly<{ status: 'suppressed'; outcomeCode: CatalogSuppressionOutcome | 'recipient-changed' }>
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
  revalidate(command: Command): Promise<CatalogRevalidation>
  authorizeAndResolve(
    command: Command,
    actor: string | null,
  ): Promise<
    Extract<
      Command,
      {
        type:
          | 'moderation.report-received'
          | 'moderation.report-decided'
          | 'moderation.appeal-received'
          | 'moderation.appeal-decided'
          | 'conversation.external-message-received'
      }
    > extends never
      ? RecipientBinding
      : CatalogAcceptance
  >
}
export type CommandCatalog = {
  readonly [Type in CommandType]?: CatalogEntry<Extract<TransactionalEmailCommand, { type: Type }>>
}

function clinicRegistrationPreparation(source: ClinicApplicationSource): EligibleCatalogPreparation | null {
  const fullName = [source.contactFirstName, source.contactLastName].filter(Boolean).join(' ').trim()
  const clinicName = source.clinicName.trim()
  const address = source.contactEmail.trim()
  if (!fullName || !clinicName || !address) return null
  return {
    status: 'eligible',
    recipient: {
      address,
      // The digest binds the exact recipient and rendered package props without storing a snapshot.
      binding: JSON.stringify([source.id, fullName, clinicName]),
    },
    prepare: () => renderClinicRegistrationReceipt(address, { fullName, clinicName }),
  }
}

export function createCommandCatalog(sources: {
  findClinicApplication(id: number): Promise<ClinicApplicationSource | null>
}): CommandCatalog {
  async function loadClinicRegistrationRecipient(
    command: Extract<TransactionalEmailCommand, { type: 'clinic.registration-received' }>,
  ): Promise<EligibleCatalogPreparation | null> {
    const source = await sources.findClinicApplication(command.registrationId)
    return source ? clinicRegistrationPreparation(source) : null
  }

  return Object.freeze({
    'clinic.registration-received': {
      isRecipientAllowed: () => true,
      async authorizeAndResolve(command, actor) {
        if (actor !== null) throw new TransactionalEmailError('access-denied')
        const preparation = await loadClinicRegistrationRecipient(command)
        if (!preparation) throw new TransactionalEmailError('source-missing')
        return preparation.recipient
      },
      async revalidate(command) {
        const source = await sources.findClinicApplication(command.registrationId)
        if (!source) return { status: 'suppressed', outcomeCode: 'source-unavailable' }
        return clinicRegistrationPreparation(source) ?? { status: 'suppressed', outcomeCode: 'ineligible' }
      },
    },
  })
}

export function resolveCatalogEntry(catalog: CommandCatalog, command: TransactionalEmailCommand): CatalogEntry {
  const entry = catalog[command.type]
  if (!entry) throw new TransactionalEmailError('unsupported-command')
  return entry as CatalogEntry
}

export async function dispatchCommandPreparation(input: {
  catalog: CommandCatalog
  command: TransactionalEmailCommand
  storedRecipientAddress: string | null
  storedRecipientDigest: string
  digestRecipient(recipient: RecipientBinding): string
}): Promise<CatalogPreparationDecision> {
  const decision = await resolveCatalogEntry(input.catalog, input.command).revalidate(input.command)
  if (decision.status === 'suppressed') return decision
  if (
    decision.recipient.address !== input.storedRecipientAddress ||
    input.digestRecipient(decision.recipient) !== input.storedRecipientDigest
  )
    return { status: 'suppressed', outcomeCode: 'recipient-changed' }
  return decision
}
