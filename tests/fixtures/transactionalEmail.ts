import { randomInt } from 'node:crypto'
import type { CommandCatalog } from '@/features/transactionalEmail/catalog'
import { TransactionalEmailError } from '@/features/transactionalEmail'
import { fakeLinks, renderSyntheticNotification } from '@/features/transactionalEmail/preparation'
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
  }
}

export function syntheticPreparation(
  registrationId: number,
  prepare = async () => renderSyntheticNotification('recipient@example.test', await fakeLinks.generate()),
) {
  return {
    status: 'eligible' as const,
    recipient: syntheticRecipient(registrationId),
    prepare,
  }
}

export function syntheticEmailCatalogWithLink(generate: () => Promise<string>): CommandCatalog {
  const entry = syntheticEmailCatalog['clinic.registration-received']!
  return Object.freeze({
    'clinic.registration-received': {
      ...entry,
      async revalidate(command) {
        const decision = await entry.revalidate(command)
        if (decision.status === 'suppressed') return decision
        return syntheticPreparation(command.registrationId, async () =>
          renderSyntheticNotification(decision.recipient.address, await generate()),
        )
      },
    },
  })
}

export const syntheticEmailCatalog: CommandCatalog = Object.freeze({
  'clinic.registration-received': {
    isRecipientAllowed: (recipient) => recipient.address.endsWith('@example.test'),
    revalidate: async (command) =>
      syntheticRegistrationIds.has(command.registrationId)
        ? syntheticPreparation(command.registrationId)
        : { status: 'suppressed', outcomeCode: 'source-unavailable' },
    authorizeAndResolve: async (command, actor) => {
      if (actor !== null) throw new TransactionalEmailError('access-denied')
      if (!syntheticRegistrationIds.has(command.registrationId)) throw new TransactionalEmailError('source-missing')
      return syntheticRecipient(command.registrationId)
    },
  },
})
