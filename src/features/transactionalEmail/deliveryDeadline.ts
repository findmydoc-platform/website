import type { TransactionalEmailOutbox } from '@/payload-types'

export function effectiveDeliveryDeadline(record: TransactionalEmailOutbox): number {
  return Math.min(
    record.deliveryDeadline
      ? Date.parse(record.deliveryDeadline)
      : record.commandType.startsWith('auth.')
        ? 0
        : Date.parse(record.createdAt) + 86_400_000,
    record.firstAmbiguousAt ? Date.parse(record.firstAmbiguousAt) + 86_400_000 : Infinity,
  )
}
