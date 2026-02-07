import type { CollectionBeforeChangeHook } from 'payload'
import { computeStorage } from '@/hooks/media/computeStorage'
import type { PlatformContentMedia } from '@/payload-types'

export const beforeChangePlatformContentMedia: CollectionBeforeChangeHook<PlatformContentMedia> = async ({
  data,
  operation,
  req,
  originalDoc,
}) => {
  const draft = { ...(data || {}) } as Partial<PlatformContentMedia>

  if (operation === 'create') {
    if (req.user && req.user.collection === 'basicUsers') {
      // Enforce createdBy from the authenticated user (ignore client input).
      draft.createdBy = req.user.id
    } else if (draft.createdBy == null) {
      throw new Error('createdBy is required for platform content media uploads')
    }
  } else if (operation === 'update' && originalDoc?.createdBy != null) {
    // Preserve original creator attribution on updates.
    draft.createdBy = originalDoc.createdBy
  }

  const { filename, storagePath } = computeStorage({
    operation,
    draft: draft as unknown as Record<string, unknown>,
    originalDoc: originalDoc as unknown as Record<string, unknown>,
    req,
    ownerField: 'platformOwner',
    key: { type: 'hash' },
    storagePrefix: 'platform',
    ownerRequired: false,
  })

  if (filename !== undefined) {
    draft.filename = filename
  }

  if (storagePath !== undefined) {
    draft.storagePath = storagePath
  }

  return draft
}
