import type { Payload } from 'payload'
import { vi } from 'vitest'

export function loseConfirmationAfterRollbackOnce(db: Payload['db']) {
  const rollback = db.rollbackTransaction.bind(db)
  return vi.spyOn(db, 'rollbackTransaction').mockImplementationOnce(async (transactionID) => {
    // Complete the native rollback before simulating its lost confirmation.
    await rollback(transactionID)
    throw new Error('Synthetic lost rollback confirmation')
  })
}
