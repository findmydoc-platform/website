import type { PreparedMessage } from './preparation'
import type { CommandType } from './commands'
import type { EmailEnvironment } from './environment'
import type { PreparedProviderRequest } from './providerPreparation'

export type DeliveryOutcome =
  { type: 'accepted'; messageId: string } | { type: 'permanent' | 'retryable' | 'ambiguous' | 'suppressed' }
export type DeliveryAttempt = PreparedMessage & {
  providerIdempotencyKey: string
  providerRequest?: PreparedProviderRequest
}
export type DeliveryAdapter = { deliver(attempt: DeliveryAttempt, signal?: AbortSignal): Promise<DeliveryOutcome> }
export type DeliveryLog = {
  operationId: string
  commandType: CommandType
  attemptNumber: number
  outcomeCode: 'fake-accepted' | 'permanent-failure' | 'retryable-failure' | 'ambiguous' | 'ineligible'
  environment: EmailEnvironment
}

export function createFakeDeliveryAdapter(): DeliveryAdapter {
  return {
    async deliver(attempt) {
      return { type: 'accepted', messageId: `fake-${attempt.providerIdempotencyKey}` }
    },
  }
}
