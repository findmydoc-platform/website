import { sql } from '@payloadcms/db-postgres'
import type { CollectionBeforeChangeHook, PayloadRequest, Where } from 'payload'

const principalCollections = ['platformStaff', 'clinicStaff', 'patients'] as const

type TransactionDatabase = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
}

type TransactionalPayloadRequest = PayloadRequest & {
  transactionID?: string | number | Promise<string | number | null> | null
}

type TransactionalDatabaseAdapter = {
  sessions?: Record<string | number, { db?: TransactionDatabase }>
}

const normalizeSupabaseUserId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

async function acquireIdentityLock(req: TransactionalPayloadRequest, supabaseUserId: string): Promise<void> {
  const transactionID = await req.transactionID
  const adapter = req.payload.db as unknown as TransactionalDatabaseAdapter
  const transactionDatabase = transactionID == null ? undefined : adapter.sessions?.[transactionID]?.db

  if (!transactionDatabase) {
    throw new Error('Supabase identity invariant requires an active Payload database transaction')
  }

  await transactionDatabase.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${supabaseUserId}))`)
}

/**
 * Prevents a Supabase identity from being attached to more than one direct
 * authentication collection. Payload executes collection writes in a database
 * transaction, so the transaction-scoped advisory lock serializes concurrent
 * cross-collection creates before any unique index can be bypassed by timing.
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

  await acquireIdentityLock(req, supabaseUserId)

  const conflicts = await Promise.all(
    principalCollections.map(async (candidateCollection) => {
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

      return result.docs.length > 0
    }),
  )

  if (conflicts.some(Boolean)) {
    throw new Error('Supabase identity is already assigned to another authentication principal')
  }

  return data
}
