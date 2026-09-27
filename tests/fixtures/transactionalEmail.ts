import type { CommandCatalog } from '@/features/transactionalEmail/catalog'
import { TransactionalEmailError } from '@/features/transactionalEmail'
import { renderSyntheticNotification } from '@/features/transactionalEmail/preparation'
import type { SuppressionLookup } from '@/features/transactionalEmail/suppression'

export const clearedSyntheticSuppression: SuppressionLookup = async () => 'cleared'

export const syntheticRegistrationId = '00000000-0000-4000-8000-000000000001'

function syntheticRecipient() {
  return {
    address: 'recipient@example.test',
    binding: syntheticRegistrationId,
    prepare: async (links: { generate(): Promise<string> }) =>
      renderSyntheticNotification('recipient@example.test', await links.generate()),
  }
}

export const syntheticEmailCatalog: CommandCatalog = Object.freeze({
  'clinic.registration-received': {
    isRecipientAllowed: (recipient) => recipient.address.endsWith('@example.test'),
    worker: {
      revalidate: async (command) => (command.registrationId === syntheticRegistrationId ? syntheticRecipient() : null),
      terminalState: 'suppressed',
    },
    authorizeAndResolve: async (command, actor) => {
      if (actor !== null) throw new TransactionalEmailError('access-denied')
      if (command.registrationId !== syntheticRegistrationId) throw new TransactionalEmailError('source-missing')
      return syntheticRecipient()
    },
  },
})
