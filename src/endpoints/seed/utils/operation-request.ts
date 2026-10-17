import type { PayloadRequest } from 'payload'

/** Each native seed operation owns its derived loader; caller authority and transaction ownership stay intact. */
export function cloneSeedOperationRequest(req: Partial<PayloadRequest> = {}): Partial<PayloadRequest> {
  const operationReq = {
    ...req,
    context: { ...req.context },
  }
  // Payload's loader closes over its request and writes transaction IDs during
  // relationship population. Reusing it would mutate the seed caller instead.
  delete operationReq.payloadDataLoader
  return operationReq
}
