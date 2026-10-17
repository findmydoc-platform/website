import { APIError, type Access, type PayloadRequest, type CollectionBeforeChangeHook, type Where } from 'payload'
import { requireNotificationTransaction } from '@/collections/clinicNotifications/common'
import {
  guardClinicAuthorizationKeys,
  guardNotificationAuthorizationSession,
  notificationClinicAuthorizationKey,
  clinicGroupAuthorizationKey,
  clinicStaffAuthorizationKey,
} from '@/features/clinicNotifications/authorizationBarrier'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { readClinicPrincipalAccess, readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import { clinicAssignmentRelationId as relationId } from '@/auth/utilities/clinicStaffAssignment'

async function currentClinics(req: PayloadRequest): Promise<number[]> {
  if (req.user?.collection !== 'clinicStaff') return []
  const access = await readClinicPrincipalAccess(req.payload, req.user.id, req)
  const ids = access?.clinics.map(({ id }) => id) ?? []
  if (req.routeParams && Object.hasOwn(req.routeParams, 'clinicId')) {
    const target = relationId(req.routeParams.clinicId)
    return ids.filter((id) => id === target)
  }
  return ids
}

export const clinicTreatmentUpdateAccess: Access = async ({ req }) => {
  if (isPlatformStaff({ req })) return true
  const ids = await currentClinics(req)
  if (!ids.length) return false
  return { clinic: ids.length === 1 ? { equals: ids[0]! } : { in: ids } }
}

export const clinicTreatmentReadAccess: Access = (args) =>
  args.req.user?.collection === 'clinicStaff' || isPlatformStaff({ req: args.req })
    ? clinicTreatmentUpdateAccess(args)
    : { active: { equals: true } }

export const clinicTreatmentCreateAccess: Access = async ({ req }) =>
  isPlatformStaff({ req }) || (await currentClinics(req)).length > 0

const denied = () => new APIError('Clinic treatment access is unavailable for this operation.', 403)
const isMutation = (operation: string) => ['create', 'update', 'delete', 'restoreVersion'].includes(operation)

/** Recheck the actual target independently of a previously rendered snapshot. */
export async function assertClinicTreatmentTarget(req: PayloadRequest, clinicId: number | string): Promise<void> {
  const target = relationId(clinicId)
  if (!target) throw denied()
  if (req.routeParams && Object.hasOwn(req.routeParams, 'clinicId') && relationId(req.routeParams.clinicId) !== target)
    throw denied()
  if (req.user?.collection === 'clinicStaff') {
    if (!(await readClinicTargetAccess(req.payload, req.user.id, target, req))) throw denied()
  } else if (req.user && !isPlatformStaff({ req })) throw denied()
}

async function creationClinic(req: PayloadRequest): Promise<number | null> {
  if (req.user?.collection !== 'clinicStaff') return null
  const access = await readClinicPrincipalAccess(req.payload, req.user.id, req)
  if (!access) return null
  const target = relationId(req.routeParams?.clinicId)
  if (req.routeParams && Object.hasOwn(req.routeParams, 'clinicId'))
    return access.clinics.some(({ id }) => id === target) ? target : null
  if (access.staff.assignmentScope === 'group' || access.staff.assignmentScope === 'unassigned') return null
  const local = relationId(access.staff.clinic)
  return access.clinics.some(({ id }) => id === local) ? local : null
}

async function protect(req: PayloadRequest, clinicIds: readonly number[]): Promise<void> {
  requireNotificationTransaction(req, await req.transactionID)
  if (!clinicIds.length) throw denied()
  const ids = [...new Set(clinicIds)]
  const keys = ids.map(notificationClinicAuthorizationKey)
  if (req.user?.collection === 'clinicStaff') keys.push(clinicStaffAuthorizationKey(req.user.id))
  for (const id of ids) {
    const clinic = await req.payload.findByID({ collection: 'clinics', id, depth: 0, overrideAccess: true, req })
    const group = relationId(clinic.group)
    if (group) keys.push(clinicGroupAuthorizationKey(group))
  }
  await guardClinicAuthorizationKeys(req, keys)
  for (const id of ids) await assertClinicTreatmentTarget(req, id)
  await guardNotificationAuthorizationSession({ req })
  requireNotificationTransaction(req, await req.transactionID)
}

/** Native Payload opens and owns the transaction before direct and bulk writes reach this hook. */
export async function guardClinicTreatmentOperation({
  args,
  operation,
  req,
}: {
  args: unknown
  operation: string
  req: PayloadRequest
}): Promise<void> {
  if (!isMutation(operation)) return
  requireNotificationTransaction(req, await req.transactionID)
  if (operation === 'delete' && req.user && !isPlatformStaff({ req })) throw denied()
  const input = args as { id?: string | number; where?: Where; data?: Record<string, unknown> }
  const ids: number[] = []
  if (operation !== 'create') {
    for (let page = 1; ; page++) {
      const result = await req.payload.find({
        collection: 'clinictreatments',
        depth: 0,
        limit: 100,
        page,
        overrideAccess: true,
        req,
        where: input.id != null ? { id: { equals: input.id } } : input.where,
      })
      for (const record of result.docs) {
        const id = relationId(record.clinic)
        if (!id) throw denied()
        ids.push(id)
      }
      if (!result.hasNextPage) break
    }
  }
  if (input.data?.clinic != null) {
    const id = relationId(input.data.clinic)
    if (!id) throw denied()
    ids.push(id)
  } else if (operation === 'create') {
    const id = await creationClinic(req)
    if (!id) throw denied()
    ids.push(id)
  }
  if (ids.length) await protect(req, ids)
}

export const guardClinicTreatmentChange: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const previous = relationId(originalDoc?.clinic)
  const target =
    relationId(data.clinic ?? originalDoc?.clinic) ?? (operation === 'create' ? await creationClinic(req) : null)
  if (!target || (originalDoc && !previous)) throw denied()
  if (req.user?.collection === 'clinicStaff' && previous && previous !== target) throw denied()
  await protect(req, previous ? [previous, target] : [target])
  return { ...data, clinic: target }
}

export async function verifyClinicTreatmentOperation<Result>({
  req,
  operation,
  result,
}: {
  req: PayloadRequest
  operation: string
  result: Result
}): Promise<Result> {
  if (!isMutation(operation)) return result
  requireNotificationTransaction(req, await req.transactionID)
  await guardNotificationAuthorizationSession({ req })
  const records =
    result && typeof result === 'object' && 'docs' in result && Array.isArray(result.docs) ? result.docs : [result]
  for (const record of records) {
    if (!record || typeof record !== 'object' || !('clinic' in record)) continue
    const id = relationId(record.clinic)
    if (!id) throw denied()
    await protect(req, [id])
  }
  requireNotificationTransaction(req, await req.transactionID)
  return result
}
