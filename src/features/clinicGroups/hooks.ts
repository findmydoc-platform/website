import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type PayloadRequest,
  type Where,
} from 'payload'
import { requireNotificationTransaction } from '@/collections/clinicNotifications/common'
import type { Clinic } from '@/payload-types'
import { platformClinicTrustAccess } from '@/access/fieldAccess'
import {
  clinicGroupAuthorizationKey,
  guardClinicAuthorizationKeys,
  guardNotificationAuthorizationSession,
} from '@/features/clinicNotifications/authorizationBarrier'

const relationId = (value: unknown): number | null => {
  if (value == null) return null
  if (typeof value === 'object' && 'id' in value) return relationId(value.id)
  const id = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN
  if (!Number.isSafeInteger(id) || id <= 0) throw new APIError('Choose a valid clinic group.', 400)
  return id
}

async function requireGroupOperator(req: PayloadRequest): Promise<void> {
  if ((await platformClinicTrustAccess({ req })) !== true)
    throw new APIError('Clinic group management requires an authorized platform operator.', 403)
}

/** Reject raw membership input before field access can silently strip an unauthorized change. */
export async function guardInitialClinicMembershipInput({
  req,
  args,
}: {
  req: PayloadRequest
  args: unknown
}): Promise<void> {
  const input = args as { data?: Record<string, unknown> }
  if (input.data && Object.hasOwn(input.data, 'group')) await requireGroupOperator(req)
}

export const assignInitialClinicGroup: CollectionBeforeChangeHook<Clinic> = async ({ data, originalDoc, req }) => {
  if (!Object.hasOwn(data, 'group')) return data
  const previous = relationId(originalDoc?.group)
  const next = relationId(data.group)
  if (previous === next) return data
  await requireGroupOperator(req)
  if (previous !== null)
    throw new APIError('Existing clinic membership requires the dedicated transfer or detachment workflow.', 409)
  if (next === null) return data
  await guardClinicAuthorizationKeys(req, [clinicGroupAuthorizationKey(next)])
  await req.payload.findByID({ collection: 'clinicGroups', id: next, depth: 0, overrideAccess: true, req })
  await guardNotificationAuthorizationSession({ req })
  return data
}

export async function guardClinicGroupOperation({
  operation,
  req,
  args,
}: {
  operation: string
  req: PayloadRequest
  args: unknown
}): Promise<void> {
  if (operation === 'create') {
    await guardClinicAuthorizationKeys(req, [])
    return
  }
  if (!['update', 'delete', 'restoreVersion'].includes(operation)) return
  const input = args as { id?: number | string; where?: Where }
  const ids: Array<number | string> = []
  if (input.id != null) ids.push(input.id)
  else {
    for (let page = 1; ; page++) {
      const result = await req.payload.find({
        collection: 'clinicGroups',
        depth: 0,
        limit: 100,
        page,
        overrideAccess: true,
        req,
        where: input.where,
      })
      ids.push(...result.docs.map((doc) => doc.id))
      if (!result.hasNextPage) break
    }
  }
  await guardClinicAuthorizationKeys(req, ids.map(clinicGroupAuthorizationKey))
}

export const guardClinicGroupWrite: CollectionBeforeChangeHook = async ({ data, req }) => {
  await requireGroupOperator(req)
  requireNotificationTransaction(req, await req.transactionID)
  await guardNotificationAuthorizationSession({ req })
  return data
}

export const rejectReferencedClinicGroupDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await requireGroupOperator(req)
  await guardNotificationAuthorizationSession({ req })
  const references = await req.payload.find({
    collection: 'clinics',
    depth: 0,
    limit: 1,
    pagination: false,
    trash: true,
    overrideAccess: true,
    req,
    where: { group: { equals: id } },
  })
  if (references.docs.length) throw new APIError('Resolve clinic memberships before deleting this group.', 409)
  const assignments = await req.payload.find({
    collection: 'clinicStaff',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
    where: { group: { equals: id } },
  })
  if (assignments.docs.length) throw new APIError('Resolve staff assignments before deleting this group.', 409)
}
