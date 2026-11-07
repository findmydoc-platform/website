import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { APIError, type CollectionBeforeOperationHook, type PayloadRequest } from 'payload'
import { resolveTransactionalEmailEnvironment } from '@/features/transactionalEmail/environment'

const PREPARATION_COOKIE = 'findmydoc_inquiry_preparations'
export const PREPARATION_LIFETIME = 7 * 24 * 60 * 60 * 1000
// Payload's singleton collection hooks and Next route bundles must share the same request capability.
const brokerKey = Symbol.for('findmydoc.inquiry-preparations.storage.v1')
const existing: unknown = Reflect.get(globalThis, brokerKey)
const storageRequests = (existing ?? new WeakSet<PayloadRequest>()) as WeakSet<PayloadRequest>
if (!existing)
  Object.defineProperty(globalThis, brokerKey, { value: storageRequests, writable: false, configurable: false })

export const guardPreparationOperation: CollectionBeforeOperationHook = ({ req }) => {
  if (!storageRequests.has(req)) throw new APIError('Preparation content is private.', 403)
}

/** Only the inquiry owner grants Local API access, including privileged reads. */
export async function withPreparationStorage<T>(req: PayloadRequest, operation: () => Promise<T>): Promise<T> {
  if (storageRequests.has(req)) return operation()
  storageRequests.add(req)
  try {
    return await operation()
  } finally {
    storageRequests.delete(req)
  }
}

function signature(binding: string): string {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('Preparation signing is unavailable.')
  return createHmac('sha256', secret)
    .update(`inquiry-preparation-v1|${resolveTransactionalEmailEnvironment()}|${binding}`)
    .digest('hex')
}

export function newPreparationBinding(): string {
  return createHmac('sha256', randomBytes(32)).update('inquiry-preparation-group').digest('hex')
}

export function preparationCookie(binding: string): string {
  return `${PREPARATION_COOKIE}=${binding}.${signature(binding)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${PREPARATION_LIFETIME / 1000}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

export function readPreparationBinding(headers: Headers | undefined): string | null {
  const value = headers
    ?.get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PREPARATION_COOKIE}=`))
    ?.slice(PREPARATION_COOKIE.length + 1)
  if (!value || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(value)) return null
  const [binding, supplied] = value.split('.') as [string, string]
  return timingSafeEqual(Buffer.from(signature(binding), 'hex'), Buffer.from(supplied, 'hex')) ? binding : null
}
