import { randomUUID } from 'node:crypto'
import { createLocalReq, ValidationError, type PayloadRequest } from 'payload'
import { requireNotificationTransaction } from '@/collections/clinicNotifications/common'
import { ClinicNotificationCaptureConflict, ClinicNotificationError } from './errors'
import { NOTIFICATION_RETENTION_MS, notificationMemberSchema, type NotificationMember } from './contracts'

type Id = string | number
type Stored = Record<string, unknown> & { id: Id }
export type NotificationCaptureMember<Member extends NotificationMember = NotificationMember> =
  Member extends NotificationMember ? Omit<Member, 'notificationId' | 'occurredAt' | 'expiresAt' | 'readAt'> : never

async function notificationReq(req: PayloadRequest): Promise<PayloadRequest> {
  const transactionID = await req.transactionID
  requireNotificationTransaction(req, transactionID)
  return createLocalReq(
    {
      user: req.user ?? undefined,
      context: { ...req.context, clinicNotificationCommand: true },
      req: { transactionID: Promise.resolve(transactionID) },
    },
    req.payload,
  )
}

async function readControl(req: PayloadRequest): Promise<Stored | undefined> {
  const result = await req.payload.find({
    collection: 'clinicNotificationControls' as never,
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
    where: { key: { equals: 'notification-center' } },
  })
  return result.docs[0] as unknown as Stored | undefined
}

async function serializeCapture(req: PayloadRequest): Promise<Stored> {
  const existing = await readControl(req)
  const args = {
    collection: 'clinicNotificationControls' as never,
    depth: 0,
    overrideAccess: true,
    req,
    data: { nonce: randomUUID(), ...(existing ? {} : { active: false, key: 'notification-center' }) },
  }
  try {
    const result = existing
      ? await req.payload.update({ ...args, id: existing.id } as never)
      : await req.payload.create(args as never)
    return result as unknown as Stored
  } catch (error) {
    if (
      !existing &&
      error instanceof ValidationError &&
      error.data.collection === 'clinicNotificationControls' &&
      error.data.errors.some(({ path }) => path === 'key')
    ) {
      throw new ClinicNotificationCaptureConflict()
    }
    throw error
  }
}

function throwCaptureError(error: unknown): never {
  if (error instanceof ClinicNotificationCaptureConflict || error instanceof ClinicNotificationError) throw error
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const details = current as Record<string, unknown>
    if (details.code === '40001' || details.code === '40P01') throw new ClinicNotificationCaptureConflict()
    current = details.cause
  }
  throw new ClinicNotificationError('SERVICE_UNAVAILABLE')
}

/** Serializes activation before a source command reads the original transition state. */
export async function prepareClinicNotificationCapture(req: PayloadRequest): Promise<void> {
  req.context = { ...req.context, clinicNotificationCaptureAttempt: true }
  try {
    const transactionReq = await notificationReq(req)
    await serializeCapture(transactionReq)
  } catch (error) {
    throwCaptureError(error)
  }
}

/** Source commands call this inside their owned transaction, after immutable source evidence exists. */
export async function captureClinicNotificationOccurrence(
  req: PayloadRequest,
  input: {
    clinicId: Id
    member: NotificationCaptureMember
    rating?: number
    occurredAt?: string
  },
): Promise<void> {
  req.context = { ...req.context, clinicNotificationCaptureAttempt: true }
  try {
    const transactionReq = await notificationReq(req)
    const control = await serializeCapture(transactionReq)
    if (control.active !== true) return
    const occurredAt = input.occurredAt ?? new Date().toISOString()
    if (typeof control.activatedAt !== 'string' || !Number.isFinite(Date.parse(control.activatedAt)))
      throw new ClinicNotificationError('SERVICE_UNAVAILABLE')
    if (Date.parse(occurredAt) < Date.parse(control.activatedAt)) return
    const member = notificationMemberSchema.parse({
      ...input.member,
      notificationId: randomUUID(),
      occurredAt,
      expiresAt: new Date(Date.parse(occurredAt) + NOTIFICATION_RETENTION_MS).toISOString(),
      readAt: null,
    })
    await req.payload.create({
      collection: 'clinicNotificationOccurrences' as never,
      depth: 0,
      overrideAccess: true,
      req: transactionReq,
      data: {
        clinicScopeId: String(input.clinicId),
        clinic: input.clinicId,
        notificationId: member.notificationId,
        schemaVersion: member.schemaVersion,
        eventType: member.eventType,
        sourceRecordKind: member.sourceRecord.kind,
        sourceRecordId: member.sourceRecord.id,
        sourceOccurrenceKind: member.sourceOccurrence.kind,
        sourceOccurrenceId: member.sourceOccurrence.id,
        occurredAt: member.occurredAt,
        expiresAt: member.expiresAt,
        ...('outcome' in member ? { outcome: member.outcome } : {}),
        ...(input.rating ? { rating: input.rating } : {}),
      },
    } as never)
  } catch (error) {
    throwCaptureError(error)
  }
}

/** This preparation-only activation interface refuses every hosted environment. */
export async function activateClinicNotificationsForTest(req: PayloadRequest): Promise<void> {
  if (process.env.DEPLOYMENT_ENV !== 'test' || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development')) {
    throw new ClinicNotificationError('CLINIC_ACCESS_DENIED')
  }
  const transactionID = await req.payload.db.beginTransaction({
    accessMode: 'read write',
    isolationLevel: 'serializable',
  })
  requireNotificationTransaction(req, transactionID)
  const transactionReq = await createLocalReq(
    { context: { clinicNotificationCommand: true }, req: { transactionID: Promise.resolve(transactionID) } },
    req.payload,
  )
  try {
    const control = await serializeCapture(transactionReq)
    if (control.active !== true) {
      await req.payload.update({
        collection: 'clinicNotificationControls' as never,
        id: control.id,
        data: { active: true, activatedAt: new Date().toISOString(), nonce: randomUUID() },
        overrideAccess: true,
        req: transactionReq,
      } as never)
    }
    requireNotificationTransaction(transactionReq, transactionID)
    await req.payload.db.commitTransaction(transactionID)
  } catch (error) {
    await req.payload.db.rollbackTransaction(transactionID)
    throw error
  }
}
