import type { PreparedMessage } from './preparation'
import type { CommandType } from './commands'
import type { EmailEnvironment } from './environment'

export type DeliveryOutcome = { type: 'accepted'; messageId: string } | { type: 'permanent' }
export type DeliveryAttempt = PreparedMessage & { providerIdempotencyKey: string }
export type DeliveryAdapter = { deliver(attempt: DeliveryAttempt): Promise<DeliveryOutcome> }
export type DeliveryLog = {
  operationId: string
  commandType: CommandType
  attemptNumber: number
  outcomeCode: 'fake-accepted' | 'permanent-failure'
  environment: EmailEnvironment
}

export function createFakeDeliveryAdapter(): DeliveryAdapter {
  return {
    async deliver(attempt) {
      return { type: 'accepted', messageId: `fake-${attempt.providerIdempotencyKey}` }
    },
  }
}
