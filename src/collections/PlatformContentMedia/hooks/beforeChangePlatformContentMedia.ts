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

  if (operation === 'create' && req.user && req.user.collection === 'basicUsers') {
    draft.createdBy = draft.createdBy ?? req.user.id
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
