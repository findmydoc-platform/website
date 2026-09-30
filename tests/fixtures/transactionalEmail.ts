import { randomInt } from 'node:crypto'
import type { CommandCatalog } from '@/features/transactionalEmail/catalog'
import { TransactionalEmailError } from '@/features/transactionalEmail'
import { renderSyntheticNotification } from '@/features/transactionalEmail/preparation'
import type { SuppressionLookup } from '@/features/transactionalEmail/suppression'

export const clearedSyntheticSuppression: SuppressionLookup = async () => 'cleared'

export const syntheticRegistrationId = 1_000_000_001
const syntheticRegistrationIds = new Set([syntheticRegistrationId])

export function createSyntheticRegistrationId(): number {
  let id: number
  do id = randomInt(1, 2_000_000_000)
  while (syntheticRegistrationIds.has(id))
  syntheticRegistrationIds.add(id)
  return id
}

function syntheticRecipient(registrationId: number) {
  return {
    address: 'recipient@example.test',
    binding: String(registrationId),
    prepare: async (links: { generate(): Promise<string> }) =>
      renderSyntheticNotification('recipient@example.test', await links.generate()),
  }
}

export const syntheticEmailCatalog: CommandCatalog = Object.freeze({
  'clinic.registration-received': {
    isRecipientAllowed: (recipient) => recipient.address.endsWith('@example.test'),
    worker: {
      revalidate: async (command) =>
        syntheticRegistrationIds.has(command.registrationId) ? syntheticRecipient(command.registrationId) : null,
      terminalState: 'suppressed',
    },
    authorizeAndResolve: async (command, actor) => {
      if (actor !== null) throw new TransactionalEmailError('access-denied')
      if (!syntheticRegistrationIds.has(command.registrationId)) throw new TransactionalEmailError('source-missing')
      return syntheticRecipient(command.registrationId)
    },
  },
})
