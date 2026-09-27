import type { PreparedMessage } from './preparation'
import type { PreparedProviderRequest } from './providerPreparation'
import type { DeliveryEdgeLog } from './operationalSignals'

export const providerOutcomeCodes = [
  'provider-accepted',
  'provider-temporary',
  'provider-rate-limited',
  'provider-ambiguous',
  'provider-idempotency-conflict',
  'provider-request-in-progress',
  'provider-conflict-unknown',
  'provider-request-rejected',
  'provider-policy-rejected',
] as const
export type ProviderOutcomeCode = (typeof providerOutcomeCodes)[number]
export type DeliveryOutcome = (
  { type: 'accepted'; messageId: string } | { type: 'permanent' | 'retryable' | 'ambiguous' | 'suppressed' }
) & { outcomeCode?: ProviderOutcomeCode; alert?: 'configuration' | 'invariant' | 'rejection' }
export type DeliveryAttempt = PreparedMessage & {
  providerIdempotencyKey: string
  providerRequest?: PreparedProviderRequest
}
export type DeliveryAdapter = { deliver(attempt: DeliveryAttempt, signal?: AbortSignal): Promise<DeliveryOutcome> }
export type DeliveryLog = DeliveryEdgeLog

export function createFakeDeliveryAdapter(): DeliveryAdapter {
  return {
    async deliver(attempt) {
      return { type: 'accepted', messageId: `fake-${attempt.providerIdempotencyKey}` }
    },
  }
}
