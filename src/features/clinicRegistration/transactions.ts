import { createLocalReq, type PayloadRequest } from 'payload'

const maximumTransactionAttempts = 3

function isActiveTransaction(req: PayloadRequest, transactionID: unknown): transactionID is number | string {
  return (
    (typeof transactionID === 'string' || typeof transactionID === 'number') &&
    Boolean(transactionID) &&
    Boolean(req.payload.db.sessions && Object.hasOwn(req.payload.db.sessions, transactionID))
  )
}

function isSerializationConflict(error: unknown): boolean {
  const visited = new Set<unknown>()
  let current = error
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current)
    const detail = current as Record<string, unknown>
    if (detail.code === '40001' || detail.code === '40P01') return true
    current = detail.cause
  }
  return false
}

export async function runClinicRegistrationTransaction<Result>(
  req: PayloadRequest,
  work: (transactionReq: PayloadRequest) => Promise<Result>,
): Promise<Result> {
  if (typeof req.transactionID !== 'undefined') throw new Error('Clinic registration transaction is unavailable')

  for (let attempt = 1; attempt <= maximumTransactionAttempts; attempt++) {
    let transactionID: number | string | null = null
    try {
      transactionID = await req.payload.db.beginTransaction({
        accessMode: 'read write',
        isolationLevel: 'serializable',
      })
      if (transactionID === null) throw new Error('Clinic registration transaction is unavailable')
      const transactionReq = await createLocalReq({ user: req.user ?? undefined, req: { transactionID } }, req.payload)
      const result = await work(transactionReq)
      if (!isActiveTransaction(transactionReq, transactionID))
        throw new Error('Clinic registration transaction is unavailable')
      await req.payload.db.commitTransaction(transactionID)
      return result
    } catch (error) {
      if (transactionID !== null) {
        try {
          await req.payload.db.rollbackTransaction(transactionID)
        } catch {
          throw new Error('Clinic registration transaction is unavailable')
        }
      }
      if (isSerializationConflict(error) && attempt < maximumTransactionAttempts) continue
      throw error
    }
  }

  throw new Error('Clinic registration transaction is unavailable')
}
