import { randomUUID } from 'node:crypto'
import { createLocalReq, type PayloadRequest, type Where } from 'payload'
import { requireNotificationTransaction } from '@/collections/clinicNotifications/common'

type Id = number | string
const key = (kind: 'clinic' | 'staff', id: Id) => `notification-authorization:${kind}:${String(id)}`

/** Clinic and staff keys are independent of the environment capture and retention controls. */
export async function lockNotificationAuthorization(req: PayloadRequest, keys: readonly string[]): Promise<void> {
  const transactionID = await req.transactionID
  requireNotificationTransaction(req, transactionID)
  const transactionReq = await createLocalReq(
    {
      user: req.user ?? undefined,
      context: { ...req.context, clinicNotificationCommand: true },
      req: { transactionID: Promise.resolve(transactionID) },
    },
    req.payload,
  )
  for (const controlKey of [...new Set(keys)].sort()) {
    const existing = (
      await req.payload.find({
        collection: 'clinicNotificationControls',
        depth: 0,
        limit: 1,
        pagination: false,
        overrideAccess: true,
        req: transactionReq,
        where: { key: { equals: controlKey } },
      })
    ).docs[0]
    if (existing)
      await req.payload.update({
        collection: 'clinicNotificationControls',
        id: existing.id,
        data: { nonce: randomUUID() },
        depth: 0,
        overrideAccess: true,
        req: transactionReq,
      })
    else
      await req.payload.create({
        collection: 'clinicNotificationControls',
        data: { key: controlKey, active: false, nonce: randomUUID() },
        depth: 0,
        overrideAccess: true,
        req: transactionReq,
      })
  }
}

export const notificationAcknowledgementKeys = (clinicId: Id, staffId: Id): string[] => [
  key('clinic', clinicId),
  key('staff', staffId),
]

async function discardCompletedAuthorizationGuard(req: PayloadRequest): Promise<void> {
  if (
    req.context?.clinicNotificationAuthorizationGuard === true &&
    req.context.clinicNotificationAuthorizationTransaction !== (await req.transactionID)
  ) {
    delete req.context.clinicNotificationAuthorizationGuard
    delete req.context.clinicNotificationAuthorizationTransaction
  }
}

export async function guardNotificationAuthorizationChange({
  operation,
  req,
  collection,
  args,
}: {
  operation: string
  req: PayloadRequest
  collection: { slug: string }
  args: unknown
}): Promise<void> {
  if (!['update', 'delete', 'restoreVersion'].includes(operation)) return
  await discardCompletedAuthorizationGuard(req)
  const controls = await req.payload.find({
    collection: 'clinicNotificationControls',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
    where: { key: { equals: 'notification-center' } },
  })
  if (!controls.docs.length) return
  const input = args as { id?: Id; where?: Where }
  const ids: Id[] = []
  if (input.id !== undefined) ids.push(input.id)
  else
    for (let page = 1; ; page++) {
      const result = await req.payload.find({
        collection: collection.slug as 'clinics' | 'clinicStaff',
        depth: 0,
        limit: 100,
        page,
        pagination: true,
        overrideAccess: true,
        req,
        where: input.where,
      })
      ids.push(...result.docs.map((doc) => doc.id))
      if (!result.hasNextPage) break
    }
  await lockNotificationAuthorization(
    req,
    ids.map((id) => key(collection.slug === 'clinics' ? 'clinic' : 'staff', id)),
  )
  req.context = {
    ...req.context,
    clinicNotificationAuthorizationGuard: true,
    clinicNotificationAuthorizationTransaction: await req.transactionID,
  }
}

/** Bulk native operations must never continue without the transaction that owns their authorization locks. */
export async function guardNotificationAuthorizationSession({ req }: { req: PayloadRequest }): Promise<void> {
  if (req.context?.clinicNotificationAuthorizationGuard === true) {
    const transactionID = await req.transactionID
    requireNotificationTransaction(req, transactionID)
    if (transactionID !== req.context.clinicNotificationAuthorizationTransaction)
      throw new Error('Notification authorization requires its original active native transaction session.')
  }
}

export async function guardNotificationInquiryMembershipChange({
  operation,
  req,
  args,
}: {
  operation: string
  req: PayloadRequest
  args: unknown
}): Promise<void> {
  if (operation !== 'update') return
  await discardCompletedAuthorizationGuard(req)
  const input = args as { id?: Id; where?: Where; data?: { clinic?: unknown } }
  if (!input.data || !Object.hasOwn(input.data, 'clinic')) return
  const clinicIds: Id[] = []
  const incoming = input.data.clinic
  if (typeof incoming === 'number' || typeof incoming === 'string') clinicIds.push(incoming)
  for (let page = 1; ; page++) {
    const result = await req.payload.find({
      collection: 'patientClinicInquiries',
      depth: 0,
      limit: 100,
      page,
      pagination: true,
      overrideAccess: true,
      req,
      where: input.id !== undefined ? { id: { equals: input.id } } : input.where,
    })
    for (const inquiry of result.docs) {
      const clinic = inquiry.clinic
      if (typeof clinic === 'number') clinicIds.push(clinic)
      else if (clinic && typeof clinic === 'object') clinicIds.push(clinic.id)
    }
    if (!result.hasNextPage) break
  }
  await lockNotificationAuthorization(
    req,
    clinicIds.map((id) => key('clinic', id)),
  )
  req.context = {
    ...req.context,
    clinicNotificationAuthorizationGuard: true,
    clinicNotificationAuthorizationTransaction: await req.transactionID,
  }
}

/** Reader deletion removes only its receipts inside the existing native staff-deletion transaction. */
export async function deleteNotificationReaderReceipts({ id, req }: { id: Id; req: PayloadRequest }): Promise<void> {
  const transactionID = await req.transactionID
  requireNotificationTransaction(req, transactionID)
  const deletionReq = await createLocalReq(
    {
      context: { ...req.context, clinicNotificationReaderDeletion: true },
      req: { transactionID: Promise.resolve(transactionID) },
    },
    req.payload,
  )
  for (;;) {
    const receipts = await req.payload.find({
      collection: 'clinicNotificationReadReceipts',
      depth: 0,
      limit: 100,
      pagination: false,
      overrideAccess: true,
      req: deletionReq,
      where: { clinicStaff: { equals: id } },
    })
    if (!receipts.docs.length) break
    for (const receipt of receipts.docs) {
      requireNotificationTransaction(deletionReq, transactionID)
      await req.payload.delete({
        collection: 'clinicNotificationReadReceipts',
        id: receipt.id,
        depth: 0,
        overrideAccess: true,
        req: deletionReq,
      })
    }
  }
  requireNotificationTransaction(req, transactionID)
}
