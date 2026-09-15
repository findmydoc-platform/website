import type { CommandCatalog } from '@/features/transactionalEmail/catalog'
import { TransactionalEmailError } from '@/features/transactionalEmail'

export const syntheticRegistrationId = '00000000-0000-4000-8000-000000000001'

export const syntheticEmailCatalog: CommandCatalog = Object.freeze({
  'clinic.registration-received': {
    authorizeAndResolve: async (command, actor) => {
      if (actor !== null) throw new TransactionalEmailError('access-denied')
      if (command.registrationId !== syntheticRegistrationId) throw new TransactionalEmailError('source-missing')
      return { address: 'recipient@example.test', binding: command.registrationId }
    },
  },
})
