import type { CollectionBeforeChangeHook } from 'payload'
import {
  buildNestedFilename,
  buildStoragePath,
  getBaseFilename,
  resolveDocumentId,
  sanitizePathSegment,
} from '@/collections/common/mediaPathHelpers'

const USER_COLLECTIONS = new Set(['basicUsers', 'patients'])

type OwnerRelation = { relationTo: string; value: string | number }

type UnionField =
  | string
  | number
  | null
  | undefined
  | { relationTo?: string; value?: string | number; id?: string | number; collection?: string }

function normalizeOwner(value: UnionField): OwnerRelation | null {
  if (!value) return null

  if (typeof value === 'string' || typeof value === 'number') {
    return { relationTo: 'basicUsers', value }
  }

  if (typeof value === 'object') {
    const relationTo = value.relationTo ?? value.collection
    const relationValue = value.value ?? value.id
    if (!relationTo || relationValue === null || relationValue === undefined) return null
    return { relationTo, value: relationValue }
  }

  return null
}

async function resolveOwnerStorageSegment(owner: OwnerRelation, payload: any): Promise<string | null> {
  if (!payload || !USER_COLLECTIONS.has(owner.relationTo)) return null

  try {
    const doc = await payload.findByID({ collection: owner.relationTo, id: owner.value, depth: 0 })
    const supabaseId = (doc as any)?.supabaseUserId
    const candidate = supabaseId ?? (doc as any)?.id ?? owner.value
    return sanitizePathSegment(candidate)
  } catch (error) {
    payload?.logger?.error?.('Error resolving user profile media owner segment', error)
    return null
  }
}

export const beforeChangeUserProfileMedia: CollectionBeforeChangeHook<any> = async ({
  data,
  operation,
  req,
  originalDoc,
}) => {
  const draft: any = { ...(data || {}) }

  const owner = normalizeOwner(draft.user) ?? normalizeOwner(originalDoc?.user)

  if (!owner || !USER_COLLECTIONS.has(owner.relationTo)) {
    throw new Error('User owner is required for user profile media uploads')
  }

  if (operation === 'update' && originalDoc?.user) {
    const existingOwner = normalizeOwner(originalDoc.user)
    if (existingOwner) {
      if (existingOwner.relationTo !== owner.relationTo || String(existingOwner.value) !== String(owner.value)) {
        throw new Error('User ownership cannot be changed once set')
      }
    }
  }

  if (operation === 'create' && req.user && USER_COLLECTIONS.has(req.user.collection)) {
    draft.createdBy = draft.createdBy ?? { relationTo: req.user.collection, value: req.user.id }
  }

  if (operation === 'create') {
    draft.user = owner
  }

  const ownerSegment =
    (await resolveOwnerStorageSegment(owner, req.payload)) ?? sanitizePathSegment(owner.value)
  const docId = resolveDocumentId({ operation, data: draft, originalDoc, req })
  const filenameSource =
    typeof draft.filename === 'string' ? draft.filename : (originalDoc as any)?.filename ?? undefined
  const baseFilename = getBaseFilename(filenameSource)

  if (!ownerSegment) {
    draft.storagePath = draft.storagePath ?? (originalDoc as any)?.storagePath
    return draft
  }

  if (!docId) {
    if (operation === 'create') {
      throw new Error('Unable to resolve document identifier for user profile media upload')
    }
    draft.storagePath = draft.storagePath ?? (originalDoc as any)?.storagePath
    return draft
  }

  if (!baseFilename) {
    if (operation === 'create') {
      throw new Error('Unable to resolve filename for user profile media upload')
    }
    draft.storagePath = draft.storagePath ?? (originalDoc as any)?.storagePath
    return draft
  }

  const nestedFilename = buildNestedFilename(ownerSegment, docId, baseFilename)
  const storagePath = buildStoragePath('users', ownerSegment, docId, baseFilename)

  if (operation === 'create' || typeof draft.filename === 'string') {
    draft.filename = nestedFilename
  }

  draft.storagePath = storagePath

  return draft
}
