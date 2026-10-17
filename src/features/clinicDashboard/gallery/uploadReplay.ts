import { readGalleryCreateFailure } from 'payload/gallery-upload-provenance'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import {
  readColdGalleryControlFailure,
  readGalleryNativeProvenance,
} from '@/features/clinicNotifications/coldAuthorizationControl'

const installed = new WeakSet<Payload>()

type Options = Parameters<Payload['create']>[0]

const replayableFailure = (error: unknown, req: PayloadRequest, clinic: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const control = readColdGalleryControlFailure(error)
  const native = readGalleryCreateFailure(error, req)
  if (
    !control ||
    !native ||
    !native.owned ||
    native.collection !== 'clinicMedia' ||
    native.phase !== 'before-upload' ||
    native.borrowedMediaFailure ||
    !native.transactionID ||
    (control.key.startsWith('notification-authorization:clinic:') &&
      control.key !== `notification-authorization:clinic:${String(clinic)}`) ||
    control.transactionID !== native.transactionID
  )
    return false
  return native.rollbacks.some((receipt) => {
    const rollback = readGalleryNativeProvenance(req)?.readRollback(receipt)
    return rollback?.adapter === req.payload.db && rollback.transactionID === native.transactionID
  })
}

/** The native create remains the owner. Only a proven pre-upload cold-key abort may start a fresh attempt. */
export function installClinicGalleryUploadReplay(payload: Payload): void {
  if (installed.has(payload)) return
  installed.add(payload)
  const create = payload.create.bind(payload)
  payload.create = (async (options: Options) => {
    if (
      options.collection !== 'clinicMedia' ||
      options.disableTransaction ||
      options.req?.transactionID != null ||
      !options.file ||
      options.filePath ||
      options.duplicateFromID != null ||
      !Buffer.isBuffer(options.file.data) ||
      options.file.tempFilePath
    )
      return create(options)

    // Snapshot caller input before any native hook mutates request, file or data.
    const data = structuredClone(options.data)
    const file = { ...options.file, data: Buffer.from(options.file.data) }
    const user = options.user ?? options.req?.user
    const context = { ...options.req?.context, ...options.context }
    const originalReq = options.req
    for (let attempt = 1; attempt <= 3; attempt++) {
      const req = await createLocalReq(
        {
          ...options,
          user: user ? structuredClone(user) : undefined,
          context: { ...context },
          req: {
            ...originalReq,
            url: originalReq?.url,
            method: originalReq?.method,
            origin: originalReq?.origin,
            pathname: originalReq?.pathname,
            searchParams: originalReq?.searchParams ? new URLSearchParams(originalReq.searchParams) : undefined,
            transactionID: undefined,
            payloadDataLoader: undefined,
            query: { ...originalReq?.query },
            routeParams: { ...originalReq?.routeParams },
            headers: new Headers(originalReq?.headers),
            context: { ...context },
          },
        },
        payload,
      )
      const attemptFile = { ...file, data: Buffer.from(file.data) }
      try {
        const result = await create({
          ...options,
          data: structuredClone(data),
          context: { ...context },
          file: attemptFile,
          req,
        } as Options)
        // Native normalization historically updates the supplied file. Publish only the successful attempt's state.
        Object.assign(options.file, attemptFile)
        return result
      } catch (error) {
        if (attempt === 3 || !replayableFailure(error, req, (data as { clinic?: unknown }).clinic)) throw error
      }
    }
    throw new Error('The native clinic media attempt limit was exhausted.')
  }) as Payload['create']
}
