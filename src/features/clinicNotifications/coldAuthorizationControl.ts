import type { PayloadRequest } from 'payload'

type ProvenanceReader = Readonly<{
  version: 'native-gallery-abort-v1'
  readUniqueFailure: (error: object) =>
    | Readonly<{
        code: string
        collection: string
        table: string
        field: string | null
        req: object
        transactionID: unknown
      }>
    | undefined
  readRollback: (receipt: object) => Readonly<{ adapter: object; transactionID: unknown }> | undefined
}>

/** Read evidence from the actual native adapter peer, never a second package instance or request context. */
export function readGalleryNativeProvenance(req: PayloadRequest): ProvenanceReader | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(req.payload.db, 'galleryUploadProvenance')
  if (!descriptor || descriptor.writable !== false || descriptor.configurable !== false) return undefined
  const value = descriptor.value as Partial<ProvenanceReader> | undefined
  if (
    !value ||
    value.version !== 'native-gallery-abort-v1' ||
    !Object.isFrozen(value) ||
    typeof value.readUniqueFailure !== 'function' ||
    typeof value.readRollback !== 'function'
  )
    return undefined
  return value as ProvenanceReader
}

const failures = new WeakMap<object, Readonly<{ key: string; transactionID: unknown }>>()

/** Only the shared cold authorization initializer can bind mapped failure evidence to its exact key. */
export async function createColdGalleryAuthorizationControl(
  req: PayloadRequest,
  key: string,
  nonce: string,
): Promise<void> {
  const transactionID = await req.transactionID
  try {
    await req.payload.create({
      collection: 'clinicNotificationControls',
      data: { key, active: false, nonce },
      depth: 0,
      overrideAccess: true,
      req,
    })
  } catch (error) {
    if (error && typeof error === 'object') {
      const mapped = readGalleryNativeProvenance(req)?.readUniqueFailure(error)
      if (
        mapped?.code === '23505' &&
        mapped.collection === 'clinicNotificationControls' &&
        mapped.table === 'clinic_notification_controls' &&
        mapped.field === 'key' &&
        mapped.req === req &&
        (await mapped.transactionID) === transactionID &&
        /^notification-authorization:(clinic|staff|group):[^:]+$/u.test(key)
      )
        failures.set(error, Object.freeze({ key, transactionID }))
    }
    throw error
  }
}

export const readColdGalleryControlFailure = (error: object) => failures.get(error)
