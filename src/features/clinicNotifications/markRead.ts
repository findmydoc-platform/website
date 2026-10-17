import { createLocalReq, type PayloadRequest } from 'payload'
import { readClinicAccessState } from '@/auth/utilities/clinicAccessState'
import { requireNotificationTransaction } from '@/collections/clinicNotifications/common'
import { readNotificationSourceProjection } from './projection'
import {
  clinicStaffAuthorizationKey,
  lockNotificationAuthorization,
  notificationClinicAuthorizationKey,
} from './authorizationBarrier'
import {
  CLINIC_NOTIFICATIONS_CONTRACT_VERSION,
  NOTIFICATION_READ_MAX_BYTES,
  notificationReadInputSchema,
  notificationMemberSchema,
  notificationReadSuccessSchema,
} from './contracts'
import { ClinicNotificationError } from './errors'
import { recordNotificationDiagnostic } from './diagnostics'

type Id = string | number

function occurrenceMember(occurrence: {
  notificationId: string
  schemaVersion: number
  eventType: string
  sourceRecordKind: string
  sourceRecordId: string
  sourceOccurrenceKind: string
  sourceOccurrenceId: string
  occurredAt: string
  expiresAt: string
  outcome?: string | null
}) {
  const parsed = notificationMemberSchema.safeParse({
    notificationId: occurrence.notificationId,
    schemaVersion: occurrence.schemaVersion,
    eventType: occurrence.eventType,
    sourceRecord: { kind: occurrence.sourceRecordKind, id: occurrence.sourceRecordId },
    sourceOccurrence: { kind: occurrence.sourceOccurrenceKind, id: occurrence.sourceOccurrenceId },
    occurredAt: occurrence.occurredAt,
    expiresAt: occurrence.expiresAt,
    readAt: null,
    ...(occurrence.outcome ? { outcome: occurrence.outcome } : {}),
  })
  if (!parsed.success) throw new ClinicNotificationError('CONTRACT_INCOMPATIBLE')
  return parsed.data
}

/** One fixed selection is acknowledged through one transaction, without automatic command retries. */
export async function markClinicNotificationsRead(
  req: PayloadRequest,
  input: { notificationIds: readonly string[] },
  attempt = 1,
) {
  const started = performance.now()
  let transactionID: Id | null = null
  let commitAttempted = false
  try {
    if (req.transactionID !== undefined) throw new ClinicNotificationError('SERVICE_UNAVAILABLE')
    const parsed = notificationReadInputSchema.safeParse(input)
    if (!parsed.success) throw new ClinicNotificationError('INVALID_INPUT')
    if (Buffer.byteLength(JSON.stringify(parsed.data)) > NOTIFICATION_READ_MAX_BYTES)
      throw new ClinicNotificationError('PAYLOAD_TOO_LARGE')
    if (req.user?.collection !== 'clinicStaff') throw new ClinicNotificationError('UNAUTHENTICATED')
    const initialAccess = await readClinicAccessState(req.payload, req.user.id, req)
    if (!initialAccess) throw new ClinicNotificationError('CLINIC_ACCESS_DENIED')
    const selectedIds = new Set(parsed.data.notificationIds)
    const ids = [...selectedIds]
    let hasUnread = false
    if (ids.length) {
      for (let page = 1; ; page++) {
        const occurrences = await req.payload.find({
          collection: 'clinicNotificationOccurrences',
          depth: 0,
          limit: 100,
          page,
          pagination: true,
          overrideAccess: true,
          req,
          where: {
            and: [
              { clinicScopeId: { equals: String(initialAccess.clinic.id) } },
              { expiresAt: { greater_than: new Date().toISOString() } },
            ],
          },
        })
        for (const occurrence of occurrences.docs) {
          if (!selectedIds.has(occurrence.notificationId)) continue
          const receipts = await req.payload.find({
            collection: 'clinicNotificationReadReceipts',
            depth: 0,
            limit: 1,
            pagination: false,
            overrideAccess: true,
            req,
            where: {
              and: [{ occurrence: { equals: occurrence.id } }, { clinicStaff: { equals: initialAccess.staff.id } }],
            },
          })
          if (
            !receipts.docs.length &&
            (await readNotificationSourceProjection(req, occurrenceMember(occurrence))).visible
          ) {
            hasUnread = true
            break
          }
        }
        if (hasUnread || !occurrences.hasNextPage) break
      }
    }
    if (!hasUnread) {
      const current = await readClinicAccessState(req.payload, req.user.id, req)
      if (!current || String(current.clinic.id) !== String(initialAccess.clinic.id))
        throw new ClinicNotificationError('CLINIC_ACCESS_DENIED')
      await recordNotificationDiagnostic(req, {
        operation: 'acknowledge',
        result: 'success',
        elapsedMs: Math.round(performance.now() - started),
      })
      return notificationReadSuccessSchema.parse({
        contractVersion: CLINIC_NOTIFICATIONS_CONTRACT_VERSION,
        serverTime: new Date().toISOString(),
        acknowledged: true,
      })
    }
    transactionID = await req.payload.db.beginTransaction({ accessMode: 'read write', isolationLevel: 'serializable' })
    requireNotificationTransaction(req, transactionID)
    const transactionReq = await createLocalReq(
      {
        user: req.user,
        context: { ...req.context, clinicNotificationCommand: true },
        req: { transactionID: Promise.resolve(transactionID) },
      },
      req.payload,
    )
    await lockNotificationAuthorization(transactionReq, [
      notificationClinicAuthorizationKey(initialAccess.clinic.id),
      clinicStaffAuthorizationKey(initialAccess.staff.id),
    ])
    const access = await readClinicAccessState(req.payload, req.user.id, transactionReq)
    if (!access || String(access.clinic.id) !== String(initialAccess.clinic.id))
      throw new ClinicNotificationError('CLINIC_ACCESS_DENIED')
    const receipts: Array<{ occurrence: number; clinicStaff: number; expiresAt: string }> = []
    let page = 1
    if (ids.length)
      for (;;) {
        const result = await req.payload.find({
          collection: 'clinicNotificationOccurrences',
          depth: 0,
          limit: 100,
          page,
          pagination: true,
          overrideAccess: true,
          req: transactionReq,
          where: {
            and: [
              { clinicScopeId: { equals: String(access.clinic.id) } },
              { expiresAt: { greater_than: new Date().toISOString() } },
            ],
          },
        })
        for (const occurrence of result.docs) {
          if (!selectedIds.has(occurrence.notificationId)) continue
          if (!(await readNotificationSourceProjection(transactionReq, occurrenceMember(occurrence))).visible) continue
          const existing = await req.payload.find({
            collection: 'clinicNotificationReadReceipts',
            depth: 0,
            limit: 1,
            pagination: false,
            overrideAccess: true,
            req: transactionReq,
            where: { and: [{ occurrence: { equals: occurrence.id } }, { clinicStaff: { equals: access.staff.id } }] },
          })
          if (!existing.docs.length)
            receipts.push({ occurrence: occurrence.id, clinicStaff: access.staff.id, expiresAt: occurrence.expiresAt })
        }
        if (!result.hasNextPage) break
        page++
      }
    for (const receipt of receipts) {
      if (Date.parse(receipt.expiresAt) <= Date.now()) continue
      await req.payload.create({
        collection: 'clinicNotificationReadReceipts',
        data: { occurrence: receipt.occurrence, clinicStaff: receipt.clinicStaff, readAt: new Date().toISOString() },
        depth: 0,
        overrideAccess: true,
        req: transactionReq,
      })
    }
    const finalAccess = await readClinicAccessState(req.payload, req.user.id, transactionReq)
    if (!finalAccess || String(finalAccess.clinic.id) !== String(initialAccess.clinic.id))
      throw new ClinicNotificationError('CLINIC_ACCESS_DENIED')
    // Eligibility is decided once under the authorization locks before the native commit call.
    const eligibilityDecidedAt = Date.now()
    if (receipts.some((receipt) => Date.parse(receipt.expiresAt) <= eligibilityDecidedAt)) {
      await req.payload.db.rollbackTransaction(transactionID)
      transactionID = null
      if (attempt >= 3) throw new ClinicNotificationError('SERVICE_UNAVAILABLE')
      return markClinicNotificationsRead(req, { notificationIds: ids }, attempt + 1)
    }
    requireNotificationTransaction(transactionReq, transactionID)
    commitAttempted = true
    await req.payload.db.commitTransaction(transactionID)
    const success = notificationReadSuccessSchema.parse({
      contractVersion: CLINIC_NOTIFICATIONS_CONTRACT_VERSION,
      serverTime: new Date().toISOString(),
      acknowledged: true,
    })
    await recordNotificationDiagnostic(req, {
      operation: 'acknowledge',
      result: 'success',
      transactionOutcome: 'committed',
      elapsedMs: Math.round(performance.now() - started),
    })
    return success
  } catch (error) {
    let outcome: 'not_committed' | 'unknown' = commitAttempted ? 'unknown' : 'not_committed'
    if (transactionID !== null) {
      try {
        await req.payload.db.rollbackTransaction(transactionID)
      } catch {
        outcome = 'unknown'
      }
    }
    const code = error instanceof ClinicNotificationError ? error.code : 'SERVICE_UNAVAILABLE'
    await recordNotificationDiagnostic(req, {
      operation: 'acknowledge',
      result: code === 'SERVICE_UNAVAILABLE' ? 'failure' : 'rejected',
      errorCode: code,
      transactionOutcome: outcome,
      elapsedMs: Math.round(performance.now() - started),
    })
    throw new ClinicNotificationError(code, outcome)
  }
}
