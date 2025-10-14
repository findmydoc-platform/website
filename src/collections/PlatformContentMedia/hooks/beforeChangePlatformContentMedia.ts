import crypto from 'crypto'
import type { CollectionBeforeChangeHook } from 'payload'
import { getBaseFilename, resolveFilenameSource } from '@/collections/common/mediaPathHelpers'

/**
 * Returns a short deterministic hash used to keep platform media storage stable.
 */
function shortHash(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 10)
}

export const beforeChangePlatformContentMedia: CollectionBeforeChangeHook<any> = async ({
  data,
  operation,
  req,
  originalDoc,
}) => {
  const draft: any = { ...(data || {}) }

  if (operation === 'create' && req.user && req.user.collection === 'basicUsers') {
    draft.createdBy = draft.createdBy ?? req.user.id
  }

  const filenameSource = resolveFilenameSource({
    req,
    draftFilename: draft?.filename,
    originalFilename: (originalDoc as any)?.filename,
  })
  const baseFilename = getBaseFilename(filenameSource)

  if (!baseFilename) {
    if (operation === 'create') {
      throw new Error('Unable to resolve filename for platform media upload')
    }
    draft.storagePath = draft.storagePath ?? (originalDoc as any)?.storagePath
    return draft
  }

  const size = (req as any)?.file?.size ?? (Array.isArray((req as any)?.files) ? (req as any).files[0]?.size : undefined)
  const raw = `platform:${baseFilename}${size ? `:${size}` : ''}`
  const derivedKey = shortHash(raw)
  const nestedFilename = `${derivedKey}/${baseFilename}`
  const storagePath = `platform/${derivedKey}/${baseFilename}`

  if (operation === 'create' || typeof draft.filename === 'string') {
    draft.filename = nestedFilename
  }

  draft.storagePath = storagePath

  try {
    req?.payload?.logger?.debug?.({
      msg: 'platform-media:derived-path',
      baseFilename,
      derivedKey,
      nestedFilename,
      storagePath,
      operation,
    })
  } catch (_error) {
    // ignore logging errors
  }

  return draft
}
