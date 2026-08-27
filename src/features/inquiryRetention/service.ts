import type { PayloadRequest } from 'payload'

import type { LegacyInquiryStatus } from '@/features/inquiryCommunication/contracts'
import { acquireInquiryCommandLock } from '@/features/inquiryAggregate/commandLock'
import { inquiryContentTombstoneKey, inquiryPackageTombstoneKey } from '@/features/inquiryAggregate/tombstones'
import {
  inquiryContentHardDeleteInputSchema,
  inquiryDeletionInputSchema,
  inquiryLegalHoldPlaceInputSchema,
  inquiryLegalHoldReleaseInputSchema,
  inquiryPendingDeleteRecoveryInputSchema,
  inquiryRetentionCutoverInputSchema,
  inquiryRetentionReviewQueueInputSchema,
  type InquiryRetentionReviewItemDTO,
  type InquiryRetentionReviewQueueDTO,
} from './contracts'
import {
  communicationReviewDueAt,
  DEFAULT_INQUIRY_RETENTION_POLICY,
  isRetentionReviewDue,
  mapLegacyInquiryState,
  moderationReviewDueAt,
} from './policy'
import type { InquiryRetentionObjectDeletionPort } from './storagePort'

type RelationId = number | string
type StoredRecord = Record<string, unknown> & { id: RelationId; createdAt?: string }

export type InquiryRetentionServiceErrorKind =
  'access-denied' | 'conflict' | 'invalid-input' | 'invalid-state' | 'not-found' | 'unauthorized' | 'unavailable'

export class InquiryRetentionServiceError extends Error {
  constructor(
    readonly kind: InquiryRetentionServiceErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'InquiryRetentionServiceError'
  }
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const relationId = (value: unknown): RelationId | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && 'id' in value) return relationId((value as { id?: unknown }).id)
  return null
}
const asRecord = (value: unknown): StoredRecord => value as StoredRecord

const findMany = async (
  req: PayloadRequest,
  collection: string,
  where: Record<string, unknown>,
  options?: { limit?: number; sort?: string | string[]; trash?: boolean },
): Promise<StoredRecord[]> => {
  const result = await req.payload.find({
    collection: collection as never,
    depth: 0,
    limit: options?.limit ?? 100,
    overrideAccess: true,
    pagination: false,
    req,
    sort: options?.sort ?? 'createdAt',
    ...(options?.trash ? { trash: true } : {}),
    where,
  } as never)
  return result.docs.map(asRecord)
}

const findOne = async (
  req: PayloadRequest,
  collection: string,
  where: Record<string, unknown>,
  options?: { sort?: string; trash?: boolean },
): Promise<StoredRecord | null> =>
  (await findMany(req, collection, where, { limit: 1, sort: options?.sort, trash: options?.trash }))[0] ?? null

const findAll = async (
  req: PayloadRequest,
  collection: string,
  where: Record<string, unknown>,
): Promise<StoredRecord[]> => {
  const records: StoredRecord[] = []
  let page = 1
  while (true) {
    const result = await req.payload.find({
      collection: collection as never,
      depth: 0,
      limit: 100,
      overrideAccess: true,
      page,
      pagination: true,
      req,
      sort: ['createdAt', 'id'],
      where,
    } as never)
    records.push(...result.docs.map(asRecord))
    if (!result.hasNextPage) break
    page = result.nextPage ?? page + 1
  }
  return records
}

const isSerializationFailure = (error: unknown): boolean => {
  const visited = new Set<unknown>()
  let current = error
  while (current !== null && typeof current !== 'undefined' && !visited.has(current)) {
    visited.add(current)
    if (typeof current !== 'object' && typeof current !== 'function') return false
    const record = current as Record<string, unknown>
    if (record.code === '40001' || record.sqlState === '40001' || record.sqlstate === '40001') return true
    current = record.cause
  }
  return false
}

const isUniqueConflict = (error: unknown): boolean => {
  const visited = new Set<unknown>()
  let current = error
  while (current !== null && typeof current !== 'undefined' && !visited.has(current)) {
    visited.add(current)
    if (typeof current !== 'object' && typeof current !== 'function') return false
    const record = current as Record<string, unknown>
    if (record.code === '23505') return true
    current = record.cause
  }
  return false
}

const runRetentionTransaction = async <Result>(
  req: PayloadRequest,
  command: () => Promise<Result>,
  lockKey?: string,
): Promise<Result> => {
  if (typeof req.transactionID !== 'undefined') {
    throw new InquiryRetentionServiceError('unavailable', 'Retention commands cannot join another transaction.')
  }
  let transactionID: null | number | string = null
  const previousContext = req.context?.inquiryRetentionCommand
  try {
    req.context = { ...(req.context ?? {}), inquiryRetentionCommand: true }
    transactionID = await req.payload.db.beginTransaction({ accessMode: 'read write', isolationLevel: 'serializable' })
    if (transactionID === null) {
      throw new InquiryRetentionServiceError('unavailable', 'A retention transaction could not be started.')
    }
    req.transactionID = transactionID
    const releaseLock = lockKey ? await acquireInquiryCommandLock(req, lockKey) : undefined
    const result = await command()
    if (releaseLock) await releaseLock()
    await req.payload.db.commitTransaction(transactionID)
    return result
  } catch (error: unknown) {
    if (transactionID !== null) await req.payload.db.rollbackTransaction(transactionID)
    if (isSerializationFailure(error)) {
      throw new InquiryRetentionServiceError('conflict', 'The retention target changed concurrently.')
    }
    throw error
  } finally {
    if (transactionID !== null && req.transactionID === transactionID) delete req.transactionID
    if (typeof previousContext === 'undefined') delete req.context?.inquiryRetentionCommand
    else req.context = { ...(req.context ?? {}), inquiryRetentionCommand: previousContext }
  }
}

const runRetryableRetentionTransaction = async <Result>(
  req: PayloadRequest,
  command: () => Promise<Result>,
  lockKey?: string,
): Promise<Result> => {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await runRetentionTransaction(req, command, lockKey)
    } catch (error: unknown) {
      lastError = error
      if (!(error instanceof InquiryRetentionServiceError && error.kind === 'conflict') || attempt === 2) throw error
    }
  }
  throw lastError
}

const resolveOperator = async (req: PayloadRequest): Promise<StoredRecord> => {
  if (!req.user) throw new InquiryRetentionServiceError('unauthorized', 'Authentication is required.')
  if (req.user.collection !== 'platformStaff') {
    throw new InquiryRetentionServiceError('access-denied', 'Inquiry retention access is required.')
  }
  const operator = await findOne(req, 'platformStaff', { id: { equals: req.user.id } })
  const capabilities = Array.isArray(operator?.capabilities) ? operator.capabilities : []
  if (!operator || !capabilities.includes('inquiry-retention')) {
    throw new InquiryRetentionServiceError('access-denied', 'Inquiry retention access is required.')
  }
  return operator
}

export type ActiveInquiryRetentionPolicy = {
  communicationReviewMonths: number
  moderationReviewMonths: number
  version: string
}

export const resolveActiveInquiryRetentionPolicy = async (
  req: PayloadRequest,
  at = new Date(),
): Promise<ActiveInquiryRetentionPolicy> => {
  const policy = await findOne(
    req,
    'inquiryRetentionPolicies',
    {
      and: [
        { policyKey: { equals: DEFAULT_INQUIRY_RETENTION_POLICY.key } },
        { status: { equals: 'active' } },
        { effectiveFrom: { less_than_equal: at.toISOString() } },
      ],
    },
    { sort: '-effectiveFrom' },
  )
  if (!policy) throw new InquiryRetentionServiceError('unavailable', 'The inquiry retention policy is unavailable.')
  const communicationReviewMonths = Number(policy.communicationReviewMonths)
  const moderationReviewMonths = Number(policy.moderationReviewMonths)
  const version = text(policy.version)
  if (!Number.isInteger(communicationReviewMonths) || !Number.isInteger(moderationReviewMonths) || !version) {
    throw new InquiryRetentionServiceError('unavailable', 'The inquiry retention policy is invalid.')
  }
  return { communicationReviewMonths, moderationReviewMonths, version }
}

export const resolveInquiryRetentionPolicyVersion = async (
  req: PayloadRequest,
  version: string,
): Promise<ActiveInquiryRetentionPolicy> => {
  const policy = await findOne(req, 'inquiryRetentionPolicies', {
    and: [{ policyKey: { equals: DEFAULT_INQUIRY_RETENTION_POLICY.key } }, { version: { equals: version } }],
  })
  if (!policy) throw new InquiryRetentionServiceError('unavailable', 'The inquiry retention policy is unavailable.')
  const communicationReviewMonths = Number(policy.communicationReviewMonths)
  const moderationReviewMonths = Number(policy.moderationReviewMonths)
  if (!Number.isInteger(communicationReviewMonths) || !Number.isInteger(moderationReviewMonths)) {
    throw new InquiryRetentionServiceError('unavailable', 'The inquiry retention policy is invalid.')
  }
  return { communicationReviewMonths, moderationReviewMonths, version }
}

const legacyStatus = (value: unknown): LegacyInquiryStatus =>
  ['submitted', 'in_review', 'contacted', 'closed', 'spam'].includes(text(value))
    ? (text(value) as LegacyInquiryStatus)
    : 'submitted'

const updateLegacyInquiry = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  policy: ActiveInquiryRetentionPolicy,
): Promise<void> => {
  const createdAt = text(inquiry.createdAt)
  if (!createdAt) throw new InquiryRetentionServiceError('invalid-state', 'The legacy inquiry has no creation time.')
  const state = mapLegacyInquiryState(legacyStatus(inquiry.status))
  if (!inquiry.handlingStatus) {
    await req.payload.update({
      collection: 'patientClinicInquiries',
      context: { inquiryRetentionCommand: true },
      data: {
        activitySequence: 0,
        clinicNotificationSequence: 0,
        clinicUnreadEpoch: 0,
        clinicUnreadFloor: 0,
        externalSequence: 0,
        handlingStatus: state.handlingStatus,
        lastActivityAt: createdAt,
        lastExternalActivityAt: null,
        lifecycle: state.lifecycle,
        retentionPolicyVersion: policy.version,
        retentionReviewBasisAt: createdAt,
        retentionReviewDueAt: communicationReviewDueAt(createdAt, policy.communicationReviewMonths),
        retentionState: 'available',
        revision: 0,
      },
      depth: 0,
      id: inquiry.id,
      overrideAccess: true,
      req,
    } as never)
  }

  if (legacyStatus(inquiry.status) !== 'closed') return
  const existing = await findOne(req, 'inquiryAuditEvents', {
    and: [{ inquiry: { equals: inquiry.id } }, { eventType: { equals: 'legacy-closed-migrated' } }],
  })
  if (existing) return
  await req.payload.create({
    collection: 'inquiryAuditEvents' as never,
    data: {
      actorId: 'system',
      actorKind: 'system',
      affectsActivity: false,
      clinic: relationId(inquiry.clinic),
      clinicNotificationSequence: 0,
      createdAt,
      eventType: 'legacy-closed-migrated',
      fromValue: 'closed',
      inquiry: inquiry.id,
      sequence: 0,
      targetId: String(inquiry.id),
      targetType: 'inquiry',
      toValue: 'submitted+closed',
    },
    depth: 0,
    overrideAccess: true,
    req,
  } as never)
}

export const cutoverLegacyInquiryCommunication = async (
  req: PayloadRequest,
  rawInput: unknown,
): Promise<{ migrated: number }> => {
  const parsed = inquiryRetentionCutoverInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryRetentionServiceError('invalid-input', 'The cutover input is invalid.')
  await resolveOperator(req)
  const policy = await resolveActiveInquiryRetentionPolicy(req)
  const candidates = await findAll(req, 'patientClinicInquiries', {
    or: [
      { handlingStatus: { exists: false } },
      {
        and: [
          { status: { equals: 'closed' } },
          { handlingStatus: { equals: 'submitted' } },
          { lifecycle: { equals: 'closed' } },
        ],
      },
    ],
  })
  let migrated = 0
  for (const inquiry of candidates) {
    if (migrated >= parsed.data.limit) break
    const changed = await runRetentionTransaction(req, async () => {
      const current = await findOne(req, 'patientClinicInquiries', { id: { equals: inquiry.id } })
      if (!current) return false
      const event = await findOne(req, 'inquiryAuditEvents', {
        and: [{ inquiry: { equals: current.id } }, { eventType: { equals: 'legacy-closed-migrated' } }],
      })
      if (current.handlingStatus && (legacyStatus(current.status) !== 'closed' || event)) return false
      await updateLegacyInquiry(req, current, policy)
      return true
    })
    if (changed) migrated += 1
  }
  return { migrated }
}

const activeHoldExists = async (req: PayloadRequest, targetType: string, targetId: RelationId): Promise<boolean> =>
  Boolean(
    await findOne(req, 'inquiryLegalHolds', {
      and: [
        { targetType: { equals: targetType } },
        { targetId: { equals: String(targetId) } },
        { status: { equals: 'active' } },
      ],
    }),
  )

const activeContentHoldExists = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  targetType: 'attachment' | 'message',
  target: StoredRecord,
): Promise<boolean> => {
  if (await activeHoldExists(req, 'inquiry', inquiry.id)) return true

  const relatedMessageIds = new Set<RelationId>()
  const relatedAttachmentIds = new Set<RelationId>()
  let relatedConversationId: RelationId | null = null
  if (targetType === 'message') {
    relatedMessageIds.add(target.id)
    relatedConversationId = relationId(target.conversation)
    for (const attachment of await findMany(req, 'inquiryAttachments', {
      and: [{ inquiry: { equals: inquiry.id } }, { boundMessage: { equals: target.id } }],
    })) {
      relatedAttachmentIds.add(attachment.id)
    }
  } else {
    relatedAttachmentIds.add(target.id)
    const boundMessageId = relationId(target.boundMessage)
    if (boundMessageId !== null) {
      relatedMessageIds.add(boundMessageId)
      const boundMessage = await findOne(req, 'inquiryMessages', { id: { equals: boundMessageId } })
      relatedConversationId = relationId(boundMessage?.conversation)
    }
  }

  const targetClauses: Record<string, unknown>[] = []
  if (relatedMessageIds.size > 0) targetClauses.push({ targetMessage: { in: [...relatedMessageIds] } })
  if (relatedAttachmentIds.size > 0) targetClauses.push({ targetAttachment: { in: [...relatedAttachmentIds] } })
  if (relatedConversationId !== null) {
    targetClauses.push({
      and: [{ targetType: { equals: 'conversation' } }, { conversation: { equals: relatedConversationId } }],
    })
  }
  if (targetClauses.length === 0) return false
  const cases = await findAll(req, 'inquiryModerationCases', {
    and: [{ inquiry: { equals: inquiry.id } }, { or: targetClauses }],
  })
  for (const moderationCase of cases) {
    if (await activeHoldExists(req, 'moderation-case', moderationCase.id)) return true
  }
  return false
}

const assertInquiryPackageIsNotHeld = async (req: PayloadRequest, inquiryId: RelationId): Promise<void> => {
  if (await activeHoldExists(req, 'inquiry', inquiryId)) {
    throw new InquiryRetentionServiceError('invalid-state', 'The inquiry package is protected by an active legal hold.')
  }
  const moderationCases = await findAll(req, 'inquiryModerationCases', { inquiry: { equals: inquiryId } })
  for (const moderationCase of moderationCases) {
    if (await activeHoldExists(req, 'moderation-case', moderationCase.id)) {
      throw new InquiryRetentionServiceError(
        'invalid-state',
        'The inquiry package is protected by an active moderation-case hold.',
      )
    }
  }
}

const identityScrubContext = {
  inquiryIdentityScrub: true,
  inquiryRetentionCommand: true,
  inquiryRetentionScrub: true,
} as const

const scrubInquiryIdentity = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  options: { deleteContents: boolean; retentionState: 'anonymized' | 'hard-deleted'; tombstoneKey: string },
): Promise<number> => {
  const previousContext = { ...(req.context ?? {}) }
  try {
    const [conversations, messages, attachments, positions, auditEvents, moderationCases, moderationEvents, notes] =
      await Promise.all([
        findAll(req, 'inquiryConversations', { inquiry: { equals: inquiry.id } }),
        findAll(req, 'inquiryMessages', { inquiry: { equals: inquiry.id } }),
        findAll(req, 'inquiryAttachments', { inquiry: { equals: inquiry.id } }),
        findAll(req, 'inquiryReadPositions', { inquiry: { equals: inquiry.id } }),
        findAll(req, 'inquiryAuditEvents', { inquiry: { equals: inquiry.id } }),
        findAll(req, 'inquiryModerationCases', { inquiry: { equals: inquiry.id } }),
        findAll(req, 'inquiryModerationEvents', { inquiry: { equals: inquiry.id } }),
        findAll(req, 'inquiryInternalNotes', { inquiry: { equals: inquiry.id } }),
      ])

    for (const conversation of conversations) {
      await req.payload.update({
        collection: 'inquiryConversations' as never,
        context: identityScrubContext,
        data: { actorKey: null, patient: null },
        depth: 0,
        id: conversation.id,
        overrideAccess: true,
        req,
      } as never)
    }
    for (const message of messages) {
      const patientAuthored = message.authorKind === 'patient'
      await req.payload.update({
        collection: 'inquiryMessages' as never,
        context: identityScrubContext,
        data: {
          actorKey: patientAuthored || options.deleteContents ? null : message.actorKey,
          authorClinicStaff: options.deleteContents ? null : message.authorClinicStaff,
          authorPatient: patientAuthored || options.deleteContents ? null : message.authorPatient,
          patient: null,
        },
        depth: 0,
        id: message.id,
        overrideAccess: true,
        req,
      } as never)
    }
    for (const attachment of attachments) {
      const patientOwned = attachment.ownerKind === 'patient'
      await req.payload.update({
        collection: 'inquiryAttachments' as never,
        context: identityScrubContext,
        data: {
          actorKey: patientOwned || options.deleteContents ? null : attachment.actorKey,
          ownerClinicStaff: options.deleteContents ? null : attachment.ownerClinicStaff,
          ownerPatient: patientOwned || options.deleteContents ? null : attachment.ownerPatient,
          patient: null,
        },
        depth: 0,
        id: attachment.id,
        overrideAccess: true,
        req,
      } as never)
    }
    for (const position of positions) {
      if (position.readerKind !== 'patient') continue
      await req.payload.update({
        collection: 'inquiryReadPositions' as never,
        context: identityScrubContext,
        data: { lastReadActivityId: null, readerKey: null, readerPatient: null },
        depth: 0,
        id: position.id,
        overrideAccess: true,
        req,
      } as never)
    }
    for (const event of auditEvents) {
      const data: Record<string, unknown> = {}
      if (event.actorKind === 'patient') data.actorId = 'deleted-patient'
      if (options.deleteContents && event.reason) data.reason = null
      if (Object.keys(data).length === 0) continue
      await req.payload.update({
        collection: 'inquiryAuditEvents' as never,
        context: identityScrubContext,
        data,
        depth: 0,
        id: event.id,
        overrideAccess: true,
        req,
      } as never)
    }
    for (const moderationCase of moderationCases) {
      await req.payload.update({
        collection: 'inquiryModerationCases' as never,
        context: identityScrubContext,
        data: {
          affectedPatient: null,
          appealPatient: null,
          patient: null,
          reporterKey: moderationCase.reporterKind === 'patient' ? null : moderationCase.reporterKey,
          reporterPatient: null,
        },
        depth: 0,
        id: moderationCase.id,
        overrideAccess: true,
        req,
      } as never)
    }
    for (const event of moderationEvents) {
      await req.payload.update({
        collection: 'inquiryModerationEvents' as never,
        context: identityScrubContext,
        data: { actorId: event.actorKind === 'patient' ? 'deleted-patient' : event.actorId, patient: null },
        depth: 0,
        id: event.id,
        overrideAccess: true,
        req,
      } as never)
    }
    if (options.deleteContents) {
      for (const note of notes) {
        await req.payload.update({
          collection: 'inquiryInternalNotes' as never,
          context: {
            inquiryPackageContentScrub: true,
            inquiryRetentionCommand: true,
            inquiryRetentionScrub: true,
          },
          data: { actorKey: null, authorClinicStaff: null, contentState: 'hard-deleted', text: null },
          depth: 0,
          id: note.id,
          overrideAccess: true,
          req,
        } as never)
      }
    }

    await req.payload.update({
      collection: 'patientClinicInquiries' as never,
      context: identityScrubContext,
      data: {
        creationActorKey: null,
        creationIdempotencyKey: null,
        creationRequestHash: null,
        deletionTombstoneKey: options.tombstoneKey,
        doctor: options.deleteContents ? null : inquiry.doctor,
        email: null,
        fullName: null,
        message: options.deleteContents ? null : inquiry.message,
        patient: null,
        phoneNumber: null,
        preferredContactWindow: options.deleteContents ? null : inquiry.preferredContactWindow,
        retentionState: options.retentionState,
        treatment: options.deleteContents ? null : inquiry.treatment,
        treatmentTimeline: options.deleteContents ? null : inquiry.treatmentTimeline,
      },
      depth: 0,
      id: inquiry.id,
      overrideAccess: true,
      req,
    } as never)

    return (
      conversations.length +
      messages.length +
      attachments.length +
      positions.length +
      auditEvents.length +
      moderationCases.length +
      moderationEvents.length +
      (options.deleteContents ? notes.length : 0) +
      1
    )
  } finally {
    req.context = previousContext
  }
}

const createInquiryPackageProof = async (
  req: PayloadRequest,
  input: {
    inquiry: StoredRecord
    objectCount: number
    operation: 'anonymized' | 'hard-deleted'
    operator: StoredRecord
    reasonCategory: string
    tombstoneKey: string
  },
): Promise<void> => {
  const policyVersion =
    text(input.inquiry.retentionPolicyVersion) || (await resolveActiveInquiryRetentionPolicy(req)).version
  await req.payload.create({
    collection: 'inquiryDeletionProofs' as never,
    context: { inquiryRetentionCommand: true },
    data: {
      deletedObjectCount: input.objectCount,
      inquiryId: String(input.inquiry.id),
      operation: input.operation,
      performedAt: new Date().toISOString(),
      performedBy: input.operator.id,
      policyVersion,
      reasonCategory: input.reasonCategory,
      tombstoneKey: input.tombstoneKey,
    },
    depth: 0,
    overrideAccess: true,
    req,
  } as never)
  await createInquiryPackageAuditEvent(req, input.inquiry, input.operator, input.operation)
}

const createInquiryPackageAuditEvent = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  operator: StoredRecord,
  operation: 'anonymized' | 'hard-deleted',
): Promise<void> => {
  const previousContext = { ...(req.context ?? {}) }
  try {
    await req.payload.create({
      collection: 'inquiryAuditEvents' as never,
      context: { inquiryRetentionAudit: true, inquiryRetentionCommand: true },
      data: {
        actorId: String(operator.id),
        actorKind: 'platform',
        affectsActivity: false,
        clinic: relationId(inquiry.clinic),
        clinicNotificationSequence: Number(inquiry.clinicNotificationSequence ?? 0),
        eventType: operation === 'anonymized' ? 'inquiry-package-anonymized' : 'inquiry-package-hard-deleted',
        inquiry: inquiry.id,
        sequence: Number(inquiry.activitySequence ?? 0),
        targetId: String(inquiry.id),
        targetType: 'inquiry',
      },
      depth: 0,
      overrideAccess: true,
      req,
    } as never)
  } finally {
    req.context = previousContext
  }
}

const createInquiryPackageDeleteIntent = async (
  req: PayloadRequest,
  input: {
    inquiry: StoredRecord
    operator: StoredRecord
    reasonCategory: string
    tombstoneKey: string
  },
): Promise<StoredRecord> => {
  const policyVersion =
    text(input.inquiry.retentionPolicyVersion) || (await resolveActiveInquiryRetentionPolicy(req)).version
  return asRecord(
    await req.payload.create({
      collection: 'inquiryDeletionProofs' as never,
      context: { inquiryRetentionCommand: true },
      data: {
        deletedObjectCount: 0,
        inquiryId: String(input.inquiry.id),
        operation: 'hard-delete-pending',
        performedAt: new Date().toISOString(),
        performedBy: input.operator.id,
        policyVersion,
        reasonCategory: input.reasonCategory,
        tombstoneKey: input.tombstoneKey,
      },
      depth: 0,
      overrideAccess: true,
      req,
    } as never),
  )
}

const finalizeInquiryPackageDeleteProof = async (
  req: PayloadRequest,
  input: { inquiry: StoredRecord; objectCount: number; operator: StoredRecord; proof: StoredRecord },
): Promise<void> => {
  await req.payload.update({
    collection: 'inquiryDeletionProofs' as never,
    context: { inquiryRetentionCommand: true, inquiryRetentionFinalizeDelete: true },
    data: {
      deletedObjectCount: input.objectCount,
      operation: 'hard-deleted',
      performedAt: new Date().toISOString(),
    },
    depth: 0,
    id: input.proof.id,
    overrideAccess: true,
    req,
  } as never)
  await createInquiryPackageAuditEvent(req, input.inquiry, input.operator, 'hard-deleted')
}

export const anonymizeInquiryPackage = async (
  req: PayloadRequest,
  rawInput: unknown,
): Promise<{ anonymized: true; replayed: boolean }> => {
  const parsed = inquiryDeletionInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryRetentionServiceError('invalid-input', 'The anonymization input is invalid.')
  const initialOperator = await resolveOperator(req)
  const input = parsed.data
  return runRetryableRetentionTransaction(
    req,
    async () => {
      const operator = await resolveOperator(req)
      if (String(operator.id) !== String(initialOperator.id)) {
        throw new InquiryRetentionServiceError('access-denied', 'The retention operator changed.')
      }
      const inquiry = await findOne(req, 'patientClinicInquiries', { id: { equals: input.inquiryId } })
      if (!inquiry) throw new InquiryRetentionServiceError('not-found', 'The inquiry does not exist.')
      const tombstoneKey = inquiryPackageTombstoneKey(inquiry.id, 'anonymized')
      const existing = await findOne(req, 'inquiryDeletionProofs', { tombstoneKey: { equals: tombstoneKey } })
      if (
        (await findOne(req, 'inquiryDeletionProofs', {
          tombstoneKey: { equals: inquiryPackageTombstoneKey(inquiry.id, 'hard-deleted') },
        })) ||
        inquiry.retentionState === 'hard-deleted'
      ) {
        throw new InquiryRetentionServiceError('invalid-state', 'The inquiry package is already hard deleted.')
      }
      if (existing) {
        await scrubInquiryIdentity(req, inquiry, {
          deleteContents: false,
          retentionState: 'anonymized',
          tombstoneKey,
        })
        return { anonymized: true as const, replayed: true }
      }
      await assertInquiryPackageIsNotHeld(req, inquiry.id)
      const objectCount = await scrubInquiryIdentity(req, inquiry, {
        deleteContents: false,
        retentionState: 'anonymized',
        tombstoneKey,
      })
      await createInquiryPackageProof(req, {
        inquiry,
        objectCount,
        operation: 'anonymized',
        operator,
        reasonCategory: input.reasonCategory,
        tombstoneKey,
      })
      return { anonymized: true as const, replayed: false }
    },
    `retention:${input.inquiryId}`,
  )
}

export const hardDeleteInquiryPackage = async (
  req: PayloadRequest,
  rawInput: unknown,
  storage?: InquiryRetentionObjectDeletionPort,
): Promise<{ deleted: true; replayed: boolean }> => {
  const parsed = inquiryDeletionInputSchema.safeParse(rawInput)
  if (!parsed.success)
    throw new InquiryRetentionServiceError('invalid-input', 'The package hard-delete input is invalid.')
  if (!storage) throw new InquiryRetentionServiceError('unavailable', 'Attachment deletion storage is unavailable.')
  const initialOperator = await resolveOperator(req)
  const input = parsed.data
  const initialInquiry = await findOne(req, 'patientClinicInquiries', { id: { equals: input.inquiryId } })
  if (!initialInquiry) throw new InquiryRetentionServiceError('not-found', 'The inquiry does not exist.')
  const tombstoneKey = inquiryPackageTombstoneKey(initialInquiry.id, 'hard-deleted')
  await runRetryableRetentionTransaction(
    req,
    async () => {
      const operator = await resolveOperator(req)
      if (String(operator.id) !== String(initialOperator.id)) {
        throw new InquiryRetentionServiceError('access-denied', 'The retention operator changed.')
      }
      const inquiry = await findOne(req, 'patientClinicInquiries', { id: { equals: input.inquiryId } })
      if (!inquiry) throw new InquiryRetentionServiceError('not-found', 'The inquiry does not exist.')
      const existing = await findOne(req, 'inquiryDeletionProofs', { tombstoneKey: { equals: tombstoneKey } })
      if (existing) {
        if (existing.operation !== 'hard-delete-pending' && existing.operation !== 'hard-deleted') {
          throw new InquiryRetentionServiceError('invalid-state', 'The package deletion intent is invalid.')
        }
        return
      }
      await assertInquiryPackageIsNotHeld(req, inquiry.id)
      await createInquiryPackageDeleteIntent(req, {
        inquiry,
        operator,
        reasonCategory: input.reasonCategory,
        tombstoneKey,
      })
    },
    `retention:${input.inquiryId}`,
  )

  const [messages, attachments] = await Promise.all([
    findAll(req, 'inquiryMessages', { inquiry: { equals: initialInquiry.id } }),
    findAll(req, 'inquiryAttachments', { inquiry: { equals: initialInquiry.id } }),
  ])
  for (const message of messages) {
    await hardDeleteInquiryContent(req, {
      inquiryId: String(initialInquiry.id),
      reasonCategory: input.reasonCategory,
      targetId: String(message.id),
      targetType: 'message',
    })
  }
  for (const attachment of attachments) {
    await hardDeleteInquiryContent(
      req,
      {
        inquiryId: String(initialInquiry.id),
        reasonCategory: input.reasonCategory,
        targetId: String(attachment.id),
        targetType: 'attachment',
      },
      storage,
    )
  }

  return runRetryableRetentionTransaction(
    req,
    async () => {
      const operator = await resolveOperator(req)
      if (String(operator.id) !== String(initialOperator.id)) {
        throw new InquiryRetentionServiceError('access-denied', 'The retention operator changed.')
      }
      const inquiry = await findOne(req, 'patientClinicInquiries', { id: { equals: input.inquiryId } })
      if (!inquiry) throw new InquiryRetentionServiceError('not-found', 'The inquiry does not exist.')
      const proof = await findOne(req, 'inquiryDeletionProofs', { tombstoneKey: { equals: tombstoneKey } })
      if (!proof || (proof.operation !== 'hard-delete-pending' && proof.operation !== 'hard-deleted')) {
        throw new InquiryRetentionServiceError('invalid-state', 'The package deletion intent is unavailable.')
      }
      const replayed = proof.operation === 'hard-deleted'
      const objectCount = await scrubInquiryIdentity(req, inquiry, {
        deleteContents: true,
        retentionState: 'hard-deleted',
        tombstoneKey,
      })
      if (!replayed) {
        await finalizeInquiryPackageDeleteProof(req, { inquiry, objectCount, operator, proof })
      }
      return { deleted: true as const, replayed }
    },
    `retention:${input.inquiryId}`,
  )
}

export const hardDeleteInquiryContent = async (
  req: PayloadRequest,
  rawInput: unknown,
  storage?: InquiryRetentionObjectDeletionPort,
): Promise<{ deleted: true; replayed: boolean }> => {
  const parsed = inquiryContentHardDeleteInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryRetentionServiceError('invalid-input', 'The hard-delete input is invalid.')
  const initialOperator = await resolveOperator(req)
  const input = parsed.data
  try {
    const intent = await runRetryableRetentionTransaction(
      req,
      async () => {
        const operator = await resolveOperator(req)
        if (String(operator.id) !== String(initialOperator.id)) {
          throw new InquiryRetentionServiceError('access-denied', 'The retention operator changed.')
        }
        const inquiry = await findOne(req, 'patientClinicInquiries', { id: { equals: input.inquiryId } })
        if (!inquiry) throw new InquiryRetentionServiceError('not-found', 'The inquiry does not exist.')
        const tombstoneKey = inquiryContentTombstoneKey(inquiry.id, input.targetType, input.targetId)
        const collection = input.targetType === 'message' ? 'inquiryMessages' : 'inquiryAttachments'
        const target = await findOne(req, collection, {
          and: [{ id: { equals: input.targetId } }, { inquiry: { equals: inquiry.id } }],
        })
        if (!target) throw new InquiryRetentionServiceError('not-found', 'The inquiry content does not exist.')
        const existingProof = await findOne(req, 'inquiryDeletionProofs', { tombstoneKey: { equals: tombstoneKey } })
        if (!existingProof && (await activeContentHoldExists(req, inquiry, input.targetType, target))) {
          throw new InquiryRetentionServiceError(
            'invalid-state',
            'The inquiry content is protected by an active legal hold.',
          )
        }

        const performedAt = new Date().toISOString()
        if (input.targetType === 'message') {
          if (target.contentState !== 'hard-deleted' || target.text !== null) {
            await req.payload.update({
              collection: 'inquiryMessages',
              context: { inquiryRetentionCommand: true, inquiryRetentionScrub: true },
              data: { contentState: 'hard-deleted', text: null },
              depth: 0,
              id: target.id,
              overrideAccess: true,
              req,
            } as never)
          }
        } else {
          if (
            target.contentState !== 'hard-deleted' ||
            target.declaredMimeType !== 'application/pdf' ||
            target.declaredSizeBytes !== 1 ||
            target.fileName !== 'deleted' ||
            target.verifiedMimeType !== null ||
            target.verifiedSizeBytes !== null
          ) {
            await req.payload.update({
              collection: 'inquiryAttachments',
              context: { inquiryRetentionCommand: true, inquiryRetentionScrub: true },
              data: {
                contentState: 'hard-deleted',
                declaredMimeType: 'application/pdf',
                declaredSizeBytes: 1,
                fileName: 'deleted',
                verifiedMimeType: null,
                verifiedSizeBytes: null,
              },
              depth: 0,
              id: target.id,
              overrideAccess: true,
              req,
            } as never)
          }
        }

        if (!existingProof) {
          const policyVersion =
            text(inquiry.retentionPolicyVersion) || (await resolveActiveInquiryRetentionPolicy(req)).version
          await req.payload.create({
            collection: 'inquiryDeletionProofs' as never,
            context: { inquiryRetentionCommand: true },
            data: {
              deletedObjectCount: input.targetType === 'message' ? 1 : 0,
              inquiryId: String(inquiry.id),
              operation: input.targetType === 'message' ? 'hard-deleted' : 'hard-delete-pending',
              performedAt,
              performedBy: operator.id,
              policyVersion,
              reasonCategory: input.reasonCategory,
              tombstoneKey,
            },
            depth: 0,
            overrideAccess: true,
            req,
          } as never)
        }
        return {
          inquiryId: inquiry.id,
          objectKeys:
            input.targetType === 'attachment'
              ? [text(target.draftObjectKey), text(target.readyObjectKey)].filter(
                  (key) => Boolean(key) && !key.startsWith('deleted/'),
                )
              : [],
          replayed: existingProof?.operation === 'hard-deleted',
          targetId: target.id,
          tombstoneKey,
        }
      },
      `retention:${input.inquiryId}`,
    )

    if (input.targetType === 'attachment') {
      if (!storage) {
        throw new InquiryRetentionServiceError('unavailable', 'Attachment deletion storage is unavailable.')
      }
      try {
        if (intent.objectKeys.length > 0) await storage.deleteObjects(intent.objectKeys)
      } catch {
        throw new InquiryRetentionServiceError('unavailable', 'The attachment content could not be deleted.')
      }
      await runRetryableRetentionTransaction(
        req,
        async () => {
          const target = await findOne(req, 'inquiryAttachments', {
            and: [{ id: { equals: intent.targetId } }, { inquiry: { equals: intent.inquiryId } }],
          })
          if (!target) throw new InquiryRetentionServiceError('not-found', 'The inquiry content does not exist.')
          const metadataFinalized =
            target.cleanupCompletedAt &&
            text(target.draftObjectKey) === `deleted/${intent.tombstoneKey}` &&
            !target.readyObjectKey
          if (!metadataFinalized) {
            await req.payload.update({
              collection: 'inquiryAttachments',
              context: { inquiryRetentionCommand: true, inquiryRetentionScrub: true },
              data: {
                cleanupCompletedAt: new Date().toISOString(),
                draftObjectKey: `deleted/${intent.tombstoneKey}`,
                readyObjectKey: null,
              },
              depth: 0,
              id: target.id,
              overrideAccess: true,
              req,
            } as never)
          }
          const proof = await findOne(req, 'inquiryDeletionProofs', {
            tombstoneKey: { equals: intent.tombstoneKey },
          })
          if (!proof) throw new InquiryRetentionServiceError('invalid-state', 'The hard-delete intent is missing.')
          if (proof.operation === 'hard-delete-pending') {
            await req.payload.update({
              collection: 'inquiryDeletionProofs' as never,
              context: { inquiryRetentionCommand: true, inquiryRetentionFinalizeDelete: true },
              data: {
                deletedObjectCount: intent.objectKeys.length,
                operation: 'hard-deleted',
                performedAt: new Date().toISOString(),
              },
              depth: 0,
              id: proof.id,
              overrideAccess: true,
              req,
            } as never)
          }
        },
        `retention:${String(intent.inquiryId)}`,
      )
    }
    return { deleted: true, replayed: intent.replayed }
  } catch (error: unknown) {
    if (isUniqueConflict(error)) {
      return hardDeleteInquiryContent(req, input, storage)
    }
    throw error
  }
}

export const resumePendingInquiryAttachmentHardDeletes = async (
  req: PayloadRequest,
  rawInput: unknown = {},
  storage?: InquiryRetentionObjectDeletionPort,
): Promise<{ examined: number; failed: number; finalized: number; nextCursor?: string }> => {
  await resolveOperator(req)
  const parsed = inquiryPendingDeleteRecoveryInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    throw new InquiryRetentionServiceError('invalid-input', 'The pending-delete recovery input is invalid.')
  }
  if (!storage) {
    throw new InquiryRetentionServiceError('unavailable', 'Attachment deletion storage is unavailable.')
  }
  type RecoveryCursor = { createdAt: string; id: RelationId }
  let cursor: RecoveryCursor | null = null
  if (parsed.data.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(parsed.data.cursor, 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >
      const id = relationId(decoded.id)
      if (typeof decoded.createdAt !== 'string' || Number.isNaN(Date.parse(decoded.createdAt)) || id === null) {
        throw new Error('Invalid cursor payload.')
      }
      cursor = { createdAt: decoded.createdAt, id }
    } catch {
      throw new InquiryRetentionServiceError('invalid-input', 'The pending-delete recovery cursor is invalid.')
    }
  }
  const cursorWhere = cursor
    ? {
        or: [
          { createdAt: { greater_than: cursor.createdAt } },
          { and: [{ createdAt: { equals: cursor.createdAt } }, { id: { greater_than: cursor.id } }] },
        ],
      }
    : null
  const page = await findMany(
    req,
    'inquiryAttachments',
    {
      and: [
        { contentState: { equals: 'hard-deleted' } },
        { cleanupCompletedAt: { exists: false } },
        ...(cursorWhere ? [cursorWhere] : []),
      ],
    },
    { limit: parsed.data.limit + 1, sort: ['createdAt', 'id'] },
  )
  const candidates = page.slice(0, parsed.data.limit)
  const lastCandidate = candidates.at(-1)
  const nextCursor =
    page.length > parsed.data.limit && lastCandidate?.createdAt
      ? Buffer.from(
          JSON.stringify({ createdAt: lastCandidate.createdAt, id: lastCandidate.id } satisfies RecoveryCursor),
          'utf8',
        ).toString('base64url')
      : undefined
  let failed = 0
  let finalized = 0
  for (const candidate of candidates) {
    const inquiryId = relationId(candidate.inquiry)
    if (inquiryId === null) continue
    const tombstoneKey = inquiryContentTombstoneKey(inquiryId, 'attachment', candidate.id)
    const proof = await findOne(req, 'inquiryDeletionProofs', {
      and: [{ tombstoneKey: { equals: tombstoneKey } }, { operation: { equals: 'hard-delete-pending' } }],
    })
    if (!proof) continue
    try {
      await hardDeleteInquiryContent(
        req,
        {
          inquiryId: String(inquiryId),
          reasonCategory: text(proof.reasonCategory),
          targetId: String(candidate.id),
          targetType: 'attachment',
        },
        storage,
      )
      finalized += 1
    } catch {
      failed += 1
    }
  }
  return { examined: candidates.length, failed, finalized, ...(nextCursor ? { nextCursor } : {}) }
}

type InquiryRetentionReviewCursor = Pick<InquiryRetentionReviewItemDTO, 'id' | 'reviewDueAt' | 'targetType'>

const compareInquiryRetentionReviewIds = (left: string, right: string): number => {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (Number.isSafeInteger(leftNumber) && Number.isSafeInteger(rightNumber)) return leftNumber - rightNumber
  return left.localeCompare(right)
}

const compareInquiryRetentionReviewItems = (
  left: InquiryRetentionReviewCursor,
  right: InquiryRetentionReviewCursor,
): number =>
  left.reviewDueAt.localeCompare(right.reviewDueAt) ||
  left.targetType.localeCompare(right.targetType) ||
  compareInquiryRetentionReviewIds(left.id, right.id)

const encodeInquiryRetentionReviewCursor = (item: InquiryRetentionReviewCursor): string =>
  Buffer.from(JSON.stringify(item), 'utf8').toString('base64url')

const decodeInquiryRetentionReviewCursor = (cursor: string | undefined): InquiryRetentionReviewCursor | null => {
  if (!cursor) return null
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<string, unknown>
    if (
      typeof decoded.id !== 'string' ||
      !decoded.id ||
      typeof decoded.reviewDueAt !== 'string' ||
      Number.isNaN(Date.parse(decoded.reviewDueAt)) ||
      !['inquiry', 'moderation-case'].includes(String(decoded.targetType))
    ) {
      throw new Error('Invalid cursor payload.')
    }
    return {
      id: decoded.id,
      reviewDueAt: decoded.reviewDueAt,
      targetType: decoded.targetType as InquiryRetentionReviewCursor['targetType'],
    }
  } catch {
    throw new InquiryRetentionServiceError('invalid-input', 'The review cursor is invalid.')
  }
}

const inquiryRetentionReviewCursorWhere = (
  cursor: InquiryRetentionReviewCursor | null,
  targetType: InquiryRetentionReviewCursor['targetType'],
): Record<string, unknown> | null => {
  if (!cursor) return null
  const targetOrder = targetType.localeCompare(cursor.targetType)
  if (targetOrder > 0) return { retentionReviewDueAt: { greater_than_equal: cursor.reviewDueAt } }
  if (targetOrder < 0) return { retentionReviewDueAt: { greater_than: cursor.reviewDueAt } }
  return {
    or: [
      { retentionReviewDueAt: { greater_than: cursor.reviewDueAt } },
      {
        and: [{ retentionReviewDueAt: { equals: cursor.reviewDueAt } }, { id: { greater_than: cursor.id } }],
      },
    ],
  }
}

const readInquiryRetentionReviewCandidates = async (
  req: PayloadRequest,
  input: {
    cursor: InquiryRetentionReviewCursor | null
    heldIds: ReadonlySet<string>
    limit: number
    now: string
    targetType: InquiryRetentionReviewCursor['targetType']
  },
): Promise<InquiryRetentionReviewItemDTO[]> => {
  const collection = input.targetType === 'inquiry' ? 'patientClinicInquiries' : 'inquiryModerationCases'
  const cursorWhere = inquiryRetentionReviewCursorWhere(input.cursor, input.targetType)
  const records = await findMany(
    req,
    collection,
    {
      and: [
        { retentionReviewDueAt: { less_than_equal: input.now } },
        ...(input.heldIds.size > 0 ? [{ id: { not_in: [...input.heldIds] } }] : []),
        ...(cursorWhere ? [cursorWhere] : []),
      ],
    },
    { limit: input.limit + 1, sort: ['retentionReviewDueAt', 'id'] },
  )

  return records.flatMap((record) => {
    const reviewDueAt = text(record.retentionReviewDueAt)
    if (!isRetentionReviewDue({ activeLegalHold: false, now: input.now, reviewDueAt })) return []
    return [
      {
        id: String(record.id),
        policyVersion: text(record.retentionPolicyVersion),
        reviewDueAt,
        targetType: input.targetType,
      },
    ]
  })
}

export const readInquiryRetentionReviewQueue = async (
  req: PayloadRequest,
  rawInput: unknown,
): Promise<InquiryRetentionReviewQueueDTO> => {
  const parsed = inquiryRetentionReviewQueueInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryRetentionServiceError('invalid-input', 'The review input is invalid.')
  await resolveOperator(req)
  const now = parsed.data.now ?? new Date().toISOString()
  const cursor = decodeInquiryRetentionReviewCursor(parsed.data.cursor)
  const activeHolds = await findAll(req, 'inquiryLegalHolds', { status: { equals: 'active' } })
  const heldInquiryIds = new Set(
    activeHolds.filter((hold) => hold.targetType === 'inquiry').map((hold) => text(hold.targetId)),
  )
  const heldModerationCaseIds = new Set(
    activeHolds.filter((hold) => hold.targetType === 'moderation-case').map((hold) => text(hold.targetId)),
  )
  const [inquiries, moderationCases] = await Promise.all([
    readInquiryRetentionReviewCandidates(req, {
      cursor,
      heldIds: heldInquiryIds,
      limit: parsed.data.limit,
      now,
      targetType: 'inquiry',
    }),
    readInquiryRetentionReviewCandidates(req, {
      cursor,
      heldIds: heldModerationCaseIds,
      limit: parsed.data.limit,
      now,
      targetType: 'moderation-case',
    }),
  ])
  const remaining = [...inquiries, ...moderationCases].sort(compareInquiryRetentionReviewItems)
  const page = remaining.slice(0, parsed.data.limit)
  const lastItem = page.at(-1)
  return {
    items: page,
    ...(remaining.length > page.length && lastItem ? { nextCursor: encodeInquiryRetentionReviewCursor(lastItem) } : {}),
  }
}

export const placeInquiryLegalHold = async (req: PayloadRequest, rawInput: unknown): Promise<{ holdId: string }> => {
  const parsed = inquiryLegalHoldPlaceInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryRetentionServiceError('invalid-input', 'The legal hold input is invalid.')
  const initialOperator = await resolveOperator(req)
  const input = parsed.data
  if (Date.parse(input.reviewAt) <= Date.now()) {
    throw new InquiryRetentionServiceError('invalid-input', 'The legal hold review date must be in the future.')
  }
  const collection = input.targetType === 'inquiry' ? 'patientClinicInquiries' : 'inquiryModerationCases'
  const initialTarget = await findOne(req, collection, { id: { equals: input.targetId } })
  if (!initialTarget) throw new InquiryRetentionServiceError('not-found', 'The retention target does not exist.')
  const initialAggregateInquiryId =
    input.targetType === 'inquiry' ? initialTarget.id : relationId(initialTarget.inquiry)
  if (initialAggregateInquiryId === null) {
    throw new InquiryRetentionServiceError('invalid-state', 'The retention target has no inquiry aggregate.')
  }
  try {
    return await runRetentionTransaction(
      req,
      async () => {
        const operator = await resolveOperator(req)
        if (String(operator.id) !== String(initialOperator.id)) {
          throw new InquiryRetentionServiceError('access-denied', 'The retention operator changed.')
        }
        const target = await findOne(req, collection, { id: { equals: input.targetId } })
        if (!target) throw new InquiryRetentionServiceError('not-found', 'The retention target does not exist.')
        const aggregateInquiryId = input.targetType === 'inquiry' ? target.id : relationId(target.inquiry)
        if (aggregateInquiryId === null) {
          throw new InquiryRetentionServiceError('invalid-state', 'The retention target has no inquiry aggregate.')
        }
        if (String(aggregateInquiryId) !== String(initialAggregateInquiryId)) {
          throw new InquiryRetentionServiceError('invalid-state', 'The retention target changed aggregates.')
        }
        const pendingPackageDelete = await findOne(req, 'inquiryDeletionProofs', {
          and: [
            { tombstoneKey: { equals: inquiryPackageTombstoneKey(aggregateInquiryId, 'hard-deleted') } },
            { operation: { equals: 'hard-delete-pending' } },
          ],
        })
        if (pendingPackageDelete) {
          throw new InquiryRetentionServiceError('invalid-state', 'The inquiry package deletion has started.')
        }
        if (await activeHoldExists(req, input.targetType, target.id)) {
          throw new InquiryRetentionServiceError('conflict', 'The retention target already has an active legal hold.')
        }
        const hold = asRecord(
          await req.payload.create({
            collection: 'inquiryLegalHolds' as never,
            context: { inquiryRetentionCommand: true },
            data: {
              activeKey: `${input.targetType}:${String(target.id)}`,
              placedAt: new Date().toISOString(),
              placedBy: operator.id,
              reasonCategory: input.reasonCategory,
              responsibleFunction: input.responsibleFunction,
              reviewAt: input.reviewAt,
              status: 'active',
              targetId: String(target.id),
              targetInquiry: input.targetType === 'inquiry' ? target.id : null,
              targetModerationCase: input.targetType === 'moderation-case' ? target.id : null,
              targetType: input.targetType,
            },
            depth: 0,
            overrideAccess: true,
            req,
          } as never),
        )
        return { holdId: String(hold.id) }
      },
      `retention:${String(initialAggregateInquiryId)}`,
    )
  } catch (error: unknown) {
    if (isUniqueConflict(error)) {
      throw new InquiryRetentionServiceError('conflict', 'The retention target already has an active legal hold.')
    }
    throw error
  }
}

export const releaseInquiryLegalHold = async (req: PayloadRequest, rawInput: unknown): Promise<{ released: true }> => {
  const parsed = inquiryLegalHoldReleaseInputSchema.safeParse(rawInput)
  if (!parsed.success)
    throw new InquiryRetentionServiceError('invalid-input', 'The legal hold release input is invalid.')
  const initialOperator = await resolveOperator(req)
  await runRetentionTransaction(req, async () => {
    const operator = await resolveOperator(req)
    if (String(operator.id) !== String(initialOperator.id)) {
      throw new InquiryRetentionServiceError('access-denied', 'The retention operator changed.')
    }
    const hold = await findOne(req, 'inquiryLegalHolds', {
      and: [{ id: { equals: parsed.data.holdId } }, { status: { equals: 'active' } }],
    })
    if (!hold) throw new InquiryRetentionServiceError('not-found', 'The legal hold does not exist.')
    await req.payload.update({
      collection: 'inquiryLegalHolds' as never,
      context: { inquiryRetentionCommand: true },
      data: { activeKey: null, releasedAt: new Date().toISOString(), releasedBy: operator.id, status: 'released' },
      depth: 0,
      id: hold.id,
      overrideAccess: true,
      req,
    } as never)
  })
  return { released: true }
}

export const stampModerationRetentionReview = (
  input: { finalOutcomeAt: string | null; measureEndedAt: string | null },
  policy: ActiveInquiryRetentionPolicy,
): { retentionPolicyVersion: string; retentionReviewDueAt: string | null } => ({
  retentionPolicyVersion: policy.version,
  retentionReviewDueAt: moderationReviewDueAt({ ...input, reviewMonths: policy.moderationReviewMonths }),
})
