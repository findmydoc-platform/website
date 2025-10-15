import type { CollectionBeforeChangeHook } from 'payload'
import { computeStorage } from '@/hooks/media/computeStorage'

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

  const { filename, storagePath } = computeStorage({
    operation,
    draft,
    originalDoc,
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
