import type { TransactionalEmailOutbox } from '@/payload-types'

export const transientFields = {
  commandPayload: null,
  recipientAddress: null,
  preparedSubject: null,
  preparedHtml: null,
  preparedText: null,
  nextAttemptAt: null,
  leaseToken: null,
  leaseExpiresAt: null,
} as const
export const outgoingTerminalStates = [
  'accepted',
  'delivered',
  'suppressed',
  'bounced',
  'complained',
  'failed',
  'expired',
]
export function needsScrubbing(record: TransactionalEmailOutbox, now: number) {
  return outgoingTerminalStates.includes(record.state)
    ? !record.scrubbedAt ||
        Object.keys(transientFields).some((key) => record[key as keyof TransactionalEmailOutbox] != null)
    : !!record.deliveryDeadline && Date.parse(record.deliveryDeadline) < now
}

export const metadataRetentionMilliseconds = 42 * 86_400_000
export function deletionEligible(record: TransactionalEmailOutbox, now: number) {
  return (
    outgoingTerminalStates.includes(record.state) &&
    !!record.scrubbedAt &&
    !!record.terminalAt &&
    Date.parse(record.terminalAt) + metadataRetentionMilliseconds <= now
  )
}
