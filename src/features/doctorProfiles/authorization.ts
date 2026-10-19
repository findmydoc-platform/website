import { requireNotificationTransaction } from '@/collections/clinicNotifications/common'
import { APIError, type Access, type CollectionBeforeChangeHook, type PayloadRequest, type Where } from 'payload'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { normalizeNativeFinalWriteOperation } from '@/access/nativeFinalOperation'
import { readClinicPrincipalAccess, readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import { clinicAssignmentRelationId as relationId } from '@/auth/utilities/clinicStaffAssignment'
import {
  guardClinicAuthorizationKeys,
  guardNotificationAuthorizationSession,
  clinicStaffAuthorizationKey,
  clinicGroupAuthorizationKey,
  notificationClinicAuthorizationKey,
} from '@/features/clinicNotifications/authorizationBarrier'

type DoctorCollection = 'doctors' | 'doctorspecialties' | 'doctortreatments' | 'doctorMedia'
const denied = () => new APIError('Doctor access is unavailable for this operation.', 403)
const mutation = (operation: string) => ['create', 'update', 'delete', 'restoreVersion'].includes(operation)

async function clinicIds(req: PayloadRequest): Promise<number[]> {
  if (req.user?.collection !== 'clinicStaff') return []
  const access = await readClinicPrincipalAccess(req.payload, req.user.id, req)
  let ids = access?.clinics.map(({ id }) => id) ?? []
  if (req.routeParams && Object.hasOwn(req.routeParams, 'clinicId')) {
    const target = relationId(req.routeParams.clinicId)
    ids = ids.filter((id) => id === target)
  }
  return ids
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

export function doctorSourceAccess(
  path: 'clinic' | 'doctor.clinic' | readonly ('clinic' | 'doctor.clinic')[] = 'clinic',
): Access {
  return async ({ req }) => {
    if (isPlatformStaff({ req })) return true
    const ids = await clinicIds(req)
    if (!ids.length) return false
    if (typeof path === 'string') return { [path]: ids.length === 1 ? { equals: ids[0]! } : { in: ids } }
    const matchingOwners = ids.map((id) => Object.fromEntries(path.map((field) => [field, { equals: id }])))
    return matchingOwners.length === 1 ? matchingOwners[0]! : { or: matchingOwners }
  }
}
export const doctorCreateAccess: Access = async ({ req }) =>
  isPlatformStaff({ req }) || (await clinicIds(req)).length > 0
export const doctorMediaCreateAccess: Access = async ({ req, data }) => {
  if (isPlatformStaff({ req })) return true
  if (!data || typeof data !== 'object' || !relationId(data.doctor)) return false
  const source = await sourceClinic(req, 'doctorMedia', { doctor: data.doctor })
  return source !== null && (await clinicIds(req)).includes(source)
}

export const doctorPublicRead: Access = (args) =>
  args.req.user?.collection === 'clinicStaff' || isPlatformStaff({ req: args.req })
    ? doctorSourceAccess()(args)
    : { active: { equals: true } }
export const doctorRelatedPublicRead: Access = (args) =>
  args.req.user?.collection === 'clinicStaff' || isPlatformStaff({ req: args.req })
    ? doctorSourceAccess('doctor.clinic')(args)
    : true

async function sourceClinic(
  req: PayloadRequest,
  collection: DoctorCollection,
  record: Record<string, unknown>,
): Promise<number | null> {
  if (collection === 'doctors') return relationId(record.clinic)
  const doctorId = relationId(record.doctor)
  if (!doctorId) return null
  const doctor = await req.payload.findByID({
    collection: 'doctors',
    id: doctorId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })
  const clinicId = relationId(doctor?.clinic)
  if (collection === 'doctorMedia' && record.clinic != null && relationId(record.clinic) !== clinicId) {
    if (req.user?.collection === 'clinicStaff') throw denied()
    return relationId(record.clinic)
  }
  return clinicId
}

async function protect(req: PayloadRequest, ids: readonly number[]): Promise<void> {
  if (!ids.length) throw denied()
  const keys = ids.map(notificationClinicAuthorizationKey)
  if (req.user?.collection === 'clinicStaff') keys.push(clinicStaffAuthorizationKey(req.user.id))
  for (const id of [...new Set(ids)]) {
    const clinic = await req.payload.findByID({ collection: 'clinics', id, depth: 0, overrideAccess: true, req })
    const group = relationId(clinic.group)
    if (group) keys.push(clinicGroupAuthorizationKey(group))
  }
  await guardClinicAuthorizationKeys(req, keys)
  if (req.user?.collection === 'clinicStaff') {
    const target =
      req.routeParams && Object.hasOwn(req.routeParams, 'clinicId') ? relationId(req.routeParams.clinicId) : undefined
    for (const id of ids)
      if ((target !== undefined && id !== target) || !(await readClinicTargetAccess(req.payload, req.user.id, id, req)))
        throw denied()
  }
  await guardNotificationAuthorizationSession({ req })
}

async function allowOrphanMediaDeletion(
  req: PayloadRequest,
  collection: DoctorCollection,
  operation: string,
  record: Record<string, unknown>,
): Promise<boolean> {
  if (collection !== 'doctorMedia' || operation !== 'delete') return false
  if (req.user && req.user.collection !== 'platformStaff') return false
  if (req.routeParams && Object.hasOwn(req.routeParams, 'clinicId')) return false
  requireNotificationTransaction(req, await req.transactionID)
  const remainingClinic = relationId(record.clinic)
  if (remainingClinic) await protect(req, [remainingClinic])
  return true
}

/** Native Payload owns the transaction before this hook, including direct and bulk collection writes. */
export async function guardDoctorOperation({
  args,
  operation,
  collection,
  req,
}: {
  args: unknown
  operation: string
  collection: { slug: string }
  req: PayloadRequest
}): Promise<void> {
  if (!mutation(operation)) return
  const slug = collection.slug as DoctorCollection
  const input = args as { id?: number | string; where?: Where; data?: Record<string, unknown>; trash?: boolean }
  const ids: number[] = []
  if (operation !== 'create') {
    for (let page = 1; ; page++) {
      const result = await req.payload.find({
        collection: slug,
        trash: input.trash,
        depth: 0,
        limit: 100,
        page,
        overrideAccess: true,
        req,
        where: input.id != null ? { id: { equals: input.id } } : input.where,
      })
      for (const record of result.docs) {
        if (
          slug === 'doctorMedia' &&
          operation === 'update' &&
          input.data &&
          Object.hasOwn(input.data, 'doctor') &&
          relationId(input.data.doctor) !== relationId((record as unknown as Record<string, unknown>).doctor)
        )
          throw new APIError('Doctor ownership cannot be changed once set', 403)
        const id = await sourceClinic(req, slug, record as unknown as Record<string, unknown>)
        if (!id) {
          if (await allowOrphanMediaDeletion(req, slug, operation, record as unknown as Record<string, unknown>))
            continue
          throw denied()
        }
        ids.push(id)
      }
      if (!result.hasNextPage) break
    }
  }
  if (input.data) {
    const data = { ...input.data }
    if (slug === 'doctors' && operation === 'create' && data.clinic == null) {
      data.clinic = await creationClinic(req)
    }
    if ((slug === 'doctors' && data.clinic != null) || (slug !== 'doctors' && data.doctor != null)) {
      const id = await sourceClinic(req, slug, slug === 'doctorMedia' ? { doctor: data.doctor } : data)
      if (!id) throw denied()
      ids.push(id)
    }
  }
  if (ids.length) await protect(req, ids)
  else if (operation === 'create') throw denied()
}

/** Preserve both the original source and the proposed relation under the same native barrier. */
export const guardDoctorChange: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  collection,
  req,
}) => {
  const slug = collection.slug as DoctorCollection
  const draft = { ...originalDoc, ...data } as Record<string, unknown>
  if (slug === 'doctors' && operation === 'create' && draft.clinic == null && req.user?.collection === 'clinicStaff') {
    draft.clinic = await creationClinic(req)
  }
  const id = await sourceClinic(req, slug, slug === 'doctorMedia' ? { ...draft, clinic: originalDoc?.clinic } : draft)
  if (!id) throw denied()
  const previous = originalDoc ? await sourceClinic(req, slug, originalDoc as Record<string, unknown>) : null
  if (req.user?.collection === 'clinicStaff' && previous && previous !== id) throw denied()
  await protect(req, previous ? [previous, id] : [id])
  return {
    ...data,
    ...(slug === 'doctors' ? { clinic: id } : {}),
    ...((slug === 'doctorspecialties' || slug === 'doctortreatments') && data.doctor != null
      ? { doctor: relationId(data.doctor) }
      : {}),
  }
}

export async function verifyDoctorOperation<Result>({
  req,
  result,
  collection,
  operation,
}: {
  req: PayloadRequest
  result: Result
  collection: { slug: string }
  operation: string
}): Promise<Result> {
  const finalOperation = normalizeNativeFinalWriteOperation(operation)
  if (!finalOperation) return result
  await guardNotificationAuthorizationSession({ req })
  const records =
    result && typeof result === 'object' && 'docs' in result && Array.isArray(result.docs) ? result.docs : [result]
  for (const record of records) {
    if (!record || typeof record !== 'object') continue
    const id = await sourceClinic(req, collection.slug as DoctorCollection, record as Record<string, unknown>)
    if (!id) {
      if (
        await allowOrphanMediaDeletion(
          req,
          collection.slug as DoctorCollection,
          finalOperation,
          record as Record<string, unknown>,
        )
      )
        continue
      throw denied()
    }
    await protect(req, [id])
  }
  await guardNotificationAuthorizationSession({ req })
  return result
}
