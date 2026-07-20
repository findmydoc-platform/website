import type { CollectionBeforeChangeHook, Where } from 'payload'

const principalCollections = ['platformStaff', 'clinicStaff', 'patients'] as const

const normalizeSupabaseUserId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

/**
 * Prevents a Supabase identity from being attached to more than one direct
 * authentication collection by checking each principal collection through the
 * Payload Local API before the write proceeds.
 */
export const enforceSupabaseIdentityInvariant: CollectionBeforeChangeHook = async ({
  collection,
  data,
  operation,
  originalDoc,
  req,
}) => {
  const supabaseUserId = normalizeSupabaseUserId(data.supabaseUserId ?? originalDoc?.supabaseUserId)
  if (!supabaseUserId) return data

  for (const candidateCollection of principalCollections) {
    const where: Where =
      operation === 'update' && candidateCollection === collection.slug && originalDoc?.id != null
        ? {
            and: [{ supabaseUserId: { equals: supabaseUserId } }, { id: { not_equals: originalDoc.id } }],
          }
        : { supabaseUserId: { equals: supabaseUserId } }

    const result = await req.payload.find({
      collection: candidateCollection,
      depth: 0,
      limit: 1,
      pagination: false,
      req,
      overrideAccess: true,
      where,
    })

    if (result.docs.length > 0) {
      throw new Error('Supabase identity is already assigned to another authentication principal')
    }
  }

  return data
}
