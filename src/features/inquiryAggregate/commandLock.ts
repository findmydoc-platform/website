import type { PayloadRequest } from 'payload'

export const acquireInquiryCommandLock = async (req: PayloadRequest, key: string): Promise<() => Promise<void>> => {
  if (typeof req.transactionID === 'undefined') throw new Error('An inquiry command transaction is required.')
  const lock = await req.payload.create({
    collection: 'inquiryCommandLocks' as never,
    context: { inquiryCommandLock: true },
    data: { key },
    depth: 0,
    overrideAccess: true,
    req,
  } as never)
  let released = false
  return async () => {
    if (released) return
    released = true
    await req.payload.delete({
      collection: 'inquiryCommandLocks' as never,
      context: { inquiryCommandLock: true },
      id: (lock as { id: number | string }).id,
      overrideAccess: true,
      req,
    } as never)
  }
}
