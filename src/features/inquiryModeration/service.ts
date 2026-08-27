import { createHash } from 'node:crypto'
import type { PayloadRequest } from 'payload'

import type {
  InquiryModerationAppealDecisionInput,
  InquiryModerationAppealInput,
  InquiryModerationAccessExpandInput,
  InquiryModerationCaseDTO,
  InquiryModerationCaseReadInput,
  InquiryModerationDecisionInput,
  InquiryModerationDTO,
  InquiryModerationReportInput,
  InquiryModerationReportReceiptDTO,
  InquiryContentModerationDTO,
} from './contracts'
import {
  inquiryModerationAppealDecisionInputSchema,
  inquiryModerationAppealInputSchema,
  inquiryModerationAccessExpandInputSchema,
  inquiryModerationCaseReadInputSchema,
  inquiryModerationDecisionInputSchema,
  inquiryModerationReportInputSchema,
} from './contracts'

export type InquiryModerationServiceErrorKind =
  | 'access-denied'
  | 'conflict'
  | 'invalid-input'
  | 'invalid-state'
  | 'not-found'
  | 'rate-limited'
  | 'unauthorized'
  | 'unavailable'

export class InquiryModerationServiceError extends Error {
  constructor(
    readonly kind: InquiryModerationServiceErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'InquiryModerationServiceError'
  }
}

type RelationId = number | string
type StoredRecord = Record<string, unknown> & { id: RelationId }

type Reporter =
  | { id: RelationId; key: string; kind: 'patient' }
  | { clinicId: RelationId; id: RelationId; key: string; kind: 'clinic' }

const relationId = (value: unknown): RelationId | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && 'id' in value) return relationId((value as { id?: unknown }).id)
  return null
}

const payloadId = (value: string): RelationId => {
  if (!/^[1-9]\d*$/u.test(value)) return value
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) ? numeric : value
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const asRecord = (value: unknown): StoredRecord => value as StoredRecord

const findOne = async (
  req: PayloadRequest,
  collection: string,
  where: Record<string, unknown>,
): Promise<StoredRecord | null> => {
  const result = await req.payload.find({
    collection: collection as never,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where,
  } as never)
  return result.docs[0] ? asRecord(result.docs[0]) : null
}

const findMany = async (
  req: PayloadRequest,
  collection: string,
  where: Record<string, unknown>,
  sort = 'createdAt',
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
      sort,
      where,
    } as never)
    records.push(...result.docs.map(asRecord))
    if (!result.hasNextPage) break
    page = result.nextPage ?? page + 1
  }
  return records
}

const REPORT_WINDOW_MS = 15 * 60 * 1_000
const REPORT_WINDOW_LIMIT = 10

const resolveReporter = async (req: PayloadRequest): Promise<Reporter> => {
  if (!req.user) throw new InquiryModerationServiceError('unauthorized', 'Authentication is required.')
  if (req.user.collection === 'patients') {
    const patient = await findOne(req, 'patients', { id: { equals: req.user.id } })
    if (!patient) throw new InquiryModerationServiceError('unauthorized', 'The patient session is unavailable.')
    return { id: patient.id, key: `patients:${String(patient.id)}`, kind: 'patient' }
  }
  if (req.user.collection === 'clinicStaff') {
    const staff = await findOne(req, 'clinicStaff', {
      and: [
        { id: { equals: req.user.id } },
        { status: { equals: 'approved' } },
        { 'authSync.status': { equals: 'synced' } },
      ],
    })
    const clinicId = relationId(staff?.clinic)
    if (!staff || clinicId === null) {
      throw new InquiryModerationServiceError('access-denied', 'The clinic principal is not access-ready.')
    }
    const clinic = await findOne(req, 'clinics', {
      and: [{ id: { equals: clinicId } }, { status: { equals: 'approved' } }],
    })
    if (!clinic) throw new InquiryModerationServiceError('access-denied', 'The clinic is not access-ready.')
    return { clinicId, id: staff.id, key: `clinicStaff:${String(staff.id)}`, kind: 'clinic' }
  }
  throw new InquiryModerationServiceError('access-denied', 'An inquiry participant is required.')
}

const readInquiryScope = async (
  req: PayloadRequest,
  reporter: Reporter,
  inquiryId: string,
): Promise<{ conversation: StoredRecord; inquiry: StoredRecord; patientId: RelationId; clinicId: RelationId }> => {
  const actorScope =
    reporter.kind === 'patient' ? { patient: { equals: reporter.id } } : { clinic: { equals: reporter.clinicId } }
  const inquiry = await findOne(req, 'patientClinicInquiries', {
    and: [{ id: { equals: payloadId(inquiryId) } }, actorScope],
  })
  const clinicId = relationId(inquiry?.clinic)
  const patientId = relationId(inquiry?.patient)
  if (!inquiry || clinicId === null || patientId === null) {
    throw new InquiryModerationServiceError('not-found', 'The inquiry does not exist.')
  }
  const conversation = await findOne(req, 'inquiryConversations', {
    and: [{ inquiry: { equals: inquiry.id } }, { clinic: { equals: clinicId } }, { patient: { equals: patientId } }],
  })
  if (!conversation) throw new InquiryModerationServiceError('not-found', 'The inquiry does not exist.')
  return { clinicId, conversation, inquiry, patientId }
}

const normalizedTargetId = (targetType: InquiryModerationReportInput['targetType'], value: string): string =>
  targetType === 'message' && value.startsWith('message:') ? value.slice('message:'.length) : value

const resolveReportTarget = async (
  req: PayloadRequest,
  reporter: Reporter,
  scope: Awaited<ReturnType<typeof readInquiryScope>>,
  input: InquiryModerationReportInput,
): Promise<{ targetAttachment?: RelationId; targetId: RelationId; targetMessage?: RelationId }> => {
  const targetId = payloadId(normalizedTargetId(input.targetType, input.targetId))
  if (input.targetType === 'conversation') {
    if (String(targetId) !== String(scope.conversation.id)) {
      throw new InquiryModerationServiceError('not-found', 'The report target does not exist.')
    }
    return { targetId: scope.conversation.id }
  }

  if (input.targetType === 'message') {
    const message = await findOne(req, 'inquiryMessages', {
      and: [{ id: { equals: targetId } }, { inquiry: { equals: scope.inquiry.id } }],
    })
    if (
      !message ||
      (reporter.kind === 'patient' && message.authorKind !== 'clinic') ||
      (reporter.kind === 'clinic' && message.authorKind !== 'patient')
    ) {
      throw new InquiryModerationServiceError('not-found', 'The report target does not exist.')
    }
    return { targetId: message.id, targetMessage: message.id }
  }

  const attachment = await findOne(req, 'inquiryAttachments', {
    and: [{ id: { equals: targetId } }, { inquiry: { equals: scope.inquiry.id } }, { state: { equals: 'bound' } }],
  })
  const messageId = relationId(attachment?.boundMessage)
  const message = messageId === null ? null : await findOne(req, 'inquiryMessages', { id: { equals: messageId } })
  if (
    !attachment ||
    !message ||
    (reporter.kind === 'patient' && message.authorKind !== 'clinic') ||
    (reporter.kind === 'clinic' && message.authorKind !== 'patient')
  ) {
    throw new InquiryModerationServiceError('not-found', 'The report target does not exist.')
  }
  return { targetAttachment: attachment.id, targetId: attachment.id }
}

const reportRequestHash = (input: InquiryModerationReportInput): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        category: input.category,
        description: input.description ?? null,
        inquiryId: input.inquiryId,
        targetId: input.targetId,
        targetType: input.targetType,
      }),
    )
    .digest('hex')

const readReportReplay = async (
  req: PayloadRequest,
  reporter: Reporter,
  input: InquiryModerationReportInput,
): Promise<StoredRecord | null> => {
  const existing = await findOne(req, 'inquiryModerationCases', {
    and: [{ reporterKey: { equals: reporter.key } }, { idempotencyKey: { equals: input.idempotencyKey } }],
  })
  if (existing && text(existing.requestHash) !== reportRequestHash(input)) {
    throw new InquiryModerationServiceError('conflict', 'The idempotency key was already used for another report.')
  }
  return existing
}

const isSerializationFailure = (error: unknown): boolean =>
  Boolean(
    error &&
    typeof error === 'object' &&
    ('code' in error || 'cause' in error) &&
    ((error as { code?: unknown }).code === '40001' || isSerializationFailure((error as { cause?: unknown }).cause)),
  )

const runCommandTransaction = async <Result>(req: PayloadRequest, command: () => Promise<Result>): Promise<Result> => {
  if (typeof req.transactionID !== 'undefined') {
    throw new InquiryModerationServiceError('unavailable', 'Moderation commands cannot join another transaction.')
  }
  let transactionID: null | number | string = null
  const previousContext = req.context?.inquiryModerationCommand
  try {
    req.context = { ...(req.context ?? {}), inquiryModerationCommand: true }
    transactionID = await req.payload.db.beginTransaction({ accessMode: 'read write', isolationLevel: 'serializable' })
    if (transactionID === null) {
      throw new InquiryModerationServiceError('unavailable', 'A moderation transaction could not be started.')
    }
    req.transactionID = transactionID
    const result = await command()
    await req.payload.db.commitTransaction(transactionID)
    return result
  } catch (error: unknown) {
    if (transactionID !== null) await req.payload.db.rollbackTransaction(transactionID)
    if (isSerializationFailure(error)) {
      throw new InquiryModerationServiceError('conflict', 'The moderation case changed concurrently.')
    }
    throw error
  } finally {
    if (transactionID !== null && req.transactionID === transactionID) delete req.transactionID
    if (typeof previousContext === 'undefined') delete req.context?.inquiryModerationCommand
    else req.context = { ...(req.context ?? {}), inquiryModerationCommand: previousContext }
  }
}

export const createInquiryModerationReport = async (
  req: PayloadRequest,
  rawInput: InquiryModerationReportInput,
): Promise<InquiryModerationReportReceiptDTO> => {
  const parsed = inquiryModerationReportInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryModerationServiceError('invalid-input', 'The report input is invalid.')
  const input = parsed.data
  const initialReporter = await resolveReporter(req)
  const initialReplay = await readReportReplay(req, initialReporter, input)
  if (initialReplay) return { received: true, reportId: String(initialReplay.id) }

  return runCommandTransaction(req, async () => {
    const reporter = await resolveReporter(req)
    if (reporter.key !== initialReporter.key) {
      throw new InquiryModerationServiceError('access-denied', 'The report actor changed.')
    }
    const replay = await readReportReplay(req, reporter, input)
    if (replay) return { received: true, reportId: String(replay.id) }

    const scope = await readInquiryScope(req, reporter, input.inquiryId)
    const target = await resolveReportTarget(req, reporter, scope, input)
    const activeDuplicate = await findOne(req, 'inquiryModerationCases', {
      and: [
        { reporterKey: { equals: reporter.key } },
        { targetType: { equals: input.targetType } },
        { targetId: { equals: String(target.targetId) } },
        { status: { in: ['open', 'decided', 'appealed'] } },
      ],
    })
    if (activeDuplicate) {
      throw new InquiryModerationServiceError('invalid-state', 'An active report already covers this target.')
    }
    const recentReports = await findMany(req, 'inquiryModerationCases', {
      and: [
        { reporterKey: { equals: reporter.key } },
        { createdAt: { greater_than_equal: new Date(Date.now() - REPORT_WINDOW_MS).toISOString() } },
      ],
    })
    if (recentReports.length >= REPORT_WINDOW_LIMIT) {
      throw new InquiryModerationServiceError('rate-limited', 'Too many reports were submitted in this window.')
    }
    const moderationCase = asRecord(
      await req.payload.create({
        collection: 'inquiryModerationCases' as never,
        context: { inquiryModerationCommand: true },
        data: {
          category: input.category,
          clinic: scope.clinicId,
          conversation: scope.conversation.id,
          ...(typeof input.description === 'string' ? { description: input.description } : {}),
          eventSequence: 1,
          idempotencyKey: input.idempotencyKey,
          inquiry: scope.inquiry.id,
          patient: scope.patientId,
          reporterClinicStaff: reporter.kind === 'clinic' ? reporter.id : null,
          reporterKey: reporter.key,
          reporterKind: reporter.kind,
          reporterPatient: reporter.kind === 'patient' ? reporter.id : null,
          requestHash: reportRequestHash(input),
          status: 'open',
          ...(target.targetAttachment ? { targetAttachment: target.targetAttachment } : {}),
          targetId: String(target.targetId),
          ...(target.targetMessage ? { targetMessage: target.targetMessage } : {}),
          targetType: input.targetType,
        },
        depth: 0,
        overrideAccess: true,
        req,
      } as never),
    )
    await req.payload.create({
      collection: 'inquiryModerationEvents' as never,
      context: { inquiryModerationCommand: true },
      data: {
        actorId: String(reporter.id),
        actorKind: reporter.kind,
        clinic: scope.clinicId,
        conversation: scope.conversation.id,
        eventType: 'report-received',
        inquiry: scope.inquiry.id,
        moderationCase: moderationCase.id,
        patient: scope.patientId,
        sequence: 1,
        targetId: String(target.targetId),
        targetType: input.targetType,
      },
      depth: 0,
      overrideAccess: true,
      req,
    } as never)
    return { received: true, reportId: String(moderationCase.id) }
  })
}

type Moderator = { id: RelationId; key: string }

const resolveModerator = async (req: PayloadRequest): Promise<Moderator> => {
  if (!req.user) throw new InquiryModerationServiceError('unauthorized', 'Authentication is required.')
  if (req.user.collection !== 'platformStaff') {
    throw new InquiryModerationServiceError('access-denied', 'A moderation platform principal is required.')
  }
  const platformStaff = await findOne(req, 'platformStaff', { id: { equals: req.user.id } })
  const capabilities = Array.isArray(platformStaff?.capabilities) ? platformStaff.capabilities : []
  if (!platformStaff || !capabilities.includes('conversation-moderation')) {
    throw new InquiryModerationServiceError('access-denied', 'Conversation moderation capability is required.')
  }
  return { id: platformStaff.id, key: `platformStaff:${String(platformStaff.id)}` }
}

const readModerationCase = async (req: PayloadRequest, caseId: string): Promise<StoredRecord> => {
  const moderationCase = await findOne(req, 'inquiryModerationCases', { id: { equals: payloadId(caseId) } })
  if (!moderationCase) throw new InquiryModerationServiceError('not-found', 'The moderation case does not exist.')
  return moderationCase
}

const caseScope = async (req: PayloadRequest, moderationCase: StoredRecord) => {
  const inquiry = await findOne(req, 'patientClinicInquiries', { id: { equals: relationId(moderationCase.inquiry) } })
  const conversation = await findOne(req, 'inquiryConversations', {
    id: { equals: relationId(moderationCase.conversation) },
  })
  const clinicId = relationId(moderationCase.clinic)
  const patientId = relationId(moderationCase.patient)
  if (!inquiry || !conversation || clinicId === null || patientId === null) {
    throw new InquiryModerationServiceError('invalid-state', 'The moderation case scope is unavailable.')
  }
  return { clinicId, conversation, inquiry, patientId }
}

const updateCaseAndCreateEvent = async (
  req: PayloadRequest,
  moderationCase: StoredRecord,
  actor: { id: RelationId; kind: 'clinic' | 'patient' | 'platform' | 'system' },
  eventType: string,
  data: Record<string, unknown> = {},
  event?: { fromValue?: string; reason?: string; toValue?: string },
): Promise<StoredRecord> => {
  const scope = await caseScope(req, moderationCase)
  const nextSequence = Number(moderationCase.eventSequence ?? 0) + 1
  const updated = asRecord(
    await req.payload.update({
      collection: 'inquiryModerationCases' as never,
      context: { inquiryModerationCommand: true },
      data: { ...data, eventSequence: nextSequence },
      depth: 0,
      id: moderationCase.id,
      overrideAccess: true,
      req,
    } as never),
  )
  await req.payload.create({
    collection: 'inquiryModerationEvents' as never,
    context: { inquiryModerationCommand: true },
    data: {
      actorId: String(actor.id),
      actorKind: actor.kind,
      clinic: scope.clinicId,
      conversation: scope.conversation.id,
      eventType,
      ...(event?.fromValue ? { fromValue: event.fromValue } : {}),
      inquiry: scope.inquiry.id,
      moderationCase: moderationCase.id,
      patient: scope.patientId,
      ...(event?.reason ? { reason: event.reason } : {}),
      sequence: nextSequence,
      targetId: text(moderationCase.targetId),
      targetType: text(moderationCase.targetType),
      ...(event?.toValue ? { toValue: event.toValue } : {}),
    },
    depth: 0,
    overrideAccess: true,
    req,
  } as never)
  return updated
}

const moderationMessageDTO = async (req: PayloadRequest, message: StoredRecord) => {
  const attachmentId = relationId(message.attachment)
  const attachment =
    attachmentId === null ? null : await findOne(req, 'inquiryAttachments', { id: { equals: attachmentId } })
  return {
    actorKind: message.authorKind === 'patient' ? ('patient' as const) : ('clinic' as const),
    ...(attachment
      ? {
          attachment: {
            fileName: text(attachment.fileName),
            id: String(attachment.id),
            mimeType: text(attachment.verifiedMimeType),
            sizeBytes: Number(attachment.verifiedSizeBytes ?? 0),
          },
        }
      : {}),
    createdAt: text(message.createdAt),
    id: `message:${String(message.id)}`,
    ...(text(message.text) ? { text: text(message.text) } : {}),
  }
}

const moderationCaseDTO = async (
  req: PayloadRequest,
  moderationCase: StoredRecord,
  scope: InquiryModerationCaseReadInput['scope'],
): Promise<InquiryModerationCaseDTO> => {
  const messages = await findMany(
    req,
    'inquiryMessages',
    { inquiry: { equals: relationId(moderationCase.inquiry) } },
    'sequence',
  )
  const targetType = text(moderationCase.targetType) as InquiryModerationCaseDTO['target']['type']
  const targetMessageId =
    targetType === 'attachment'
      ? relationId(
          (
            await findOne(req, 'inquiryAttachments', {
              id: { equals: relationId(moderationCase.targetAttachment) },
            })
          )?.boundMessage,
        )
      : relationId(moderationCase.targetMessage)
  const targetMessageIndex = messages.findIndex((message) => String(message.id) === String(targetMessageId))
  const contextMessages =
    targetMessageIndex >= 0
      ? messages.slice(Math.max(0, targetMessageIndex - 1), Math.min(messages.length, targetMessageIndex + 2))
      : []
  const targetMessage = targetMessageIndex >= 0 ? messages[targetMessageIndex] : null
  const targetAttachment =
    targetType === 'attachment'
      ? await findOne(req, 'inquiryAttachments', { id: { equals: relationId(moderationCase.targetAttachment) } })
      : null
  const target =
    targetType === 'conversation'
      ? {
          createdAt: text(moderationCase.createdAt),
          id: String(relationId(moderationCase.conversation)),
          type: targetType,
        }
      : targetType === 'attachment' && targetAttachment && targetMessage
        ? {
            attachment: {
              fileName: text(targetAttachment.fileName),
              id: String(targetAttachment.id),
              mimeType: text(targetAttachment.verifiedMimeType),
              sizeBytes: Number(targetAttachment.verifiedSizeBytes ?? 0),
            },
            createdAt: text(targetMessage.createdAt),
            id: String(targetAttachment.id),
            type: targetType,
          }
        : targetMessage
          ? { ...(await moderationMessageDTO(req, targetMessage)), type: targetType }
          : null
  if (!target) throw new InquiryModerationServiceError('invalid-state', 'The reported object is unavailable.')

  return {
    caseId: String(moderationCase.id),
    category: text(moderationCase.category) as InquiryModerationCaseDTO['category'],
    context: contextMessages.map((message) => ({
      actorKind: message.authorKind === 'patient' ? 'patient' : 'clinic',
      createdAt: text(message.createdAt),
      id: `message:${String(message.id)}`,
    })),
    ...(scope === 'full-conversation' || targetType === 'conversation'
      ? { conversation: await Promise.all(messages.map((message) => moderationMessageDTO(req, message))) }
      : {}),
    ...(text(moderationCase.description) ? { description: text(moderationCase.description) } : {}),
    target,
  }
}

export const readInquiryModerationCase = async (
  req: PayloadRequest,
  rawInput: InquiryModerationCaseReadInput,
): Promise<InquiryModerationCaseDTO> => {
  const parsed = inquiryModerationCaseReadInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryModerationServiceError('invalid-input', 'The moderation case input is invalid.')
  const input = parsed.data
  const initialModerator = await resolveModerator(req)
  const initialCase = await readModerationCase(req, input.caseId)
  if (
    input.scope === 'full-conversation' &&
    initialCase.targetType !== 'conversation' &&
    !initialCase.accessExpandedAt
  ) {
    throw new InquiryModerationServiceError('invalid-state', 'Full conversation access has not been justified.')
  }

  const updatedCase = await runCommandTransaction(req, async () => {
    const moderator = await resolveModerator(req)
    if (moderator.key !== initialModerator.key) {
      throw new InquiryModerationServiceError('access-denied', 'The moderation actor changed.')
    }
    const moderationCase = await readModerationCase(req, input.caseId)
    if (
      input.scope === 'full-conversation' &&
      moderationCase.targetType !== 'conversation' &&
      !moderationCase.accessExpandedAt
    ) {
      throw new InquiryModerationServiceError('invalid-state', 'Full conversation access has not been justified.')
    }
    return updateCaseAndCreateEvent(
      req,
      moderationCase,
      { id: moderator.id, kind: 'platform' },
      'case-accessed',
      {},
      {
        toValue: input.scope,
      },
    )
  })
  return moderationCaseDTO(req, updatedCase, input.scope)
}

export const expandInquiryModerationAccess = async (
  req: PayloadRequest,
  rawInput: InquiryModerationAccessExpandInput,
): Promise<{ expanded: true }> => {
  const parsed = inquiryModerationAccessExpandInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryModerationServiceError('invalid-input', 'The access reason is invalid.')
  const input = parsed.data
  const initialModerator = await resolveModerator(req)
  await runCommandTransaction(req, async () => {
    const moderator = await resolveModerator(req)
    if (moderator.key !== initialModerator.key) {
      throw new InquiryModerationServiceError('access-denied', 'The moderation actor changed.')
    }
    const moderationCase = await readModerationCase(req, input.caseId)
    if (moderationCase.targetType === 'conversation' || moderationCase.accessExpandedAt) return moderationCase
    return updateCaseAndCreateEvent(
      req,
      moderationCase,
      { id: moderator.id, kind: 'platform' },
      'access-expanded',
      {
        accessExpandedAt: new Date().toISOString(),
        accessExpandedBy: moderator.id,
        accessExpansionReason: input.reason,
      },
      { reason: input.reason, toValue: 'full-conversation' },
    )
  })
  return { expanded: true }
}

const affectedActorForDecision = async (
  req: PayloadRequest,
  moderationCase: StoredRecord,
  input: InquiryModerationDecisionInput,
): Promise<{ id: RelationId; kind: 'clinic' | 'patient' } | null> => {
  if (input.outcome === 'no-action') return null
  if (input.outcome === 'content-restricted') {
    const message =
      moderationCase.targetType === 'message'
        ? await findOne(req, 'inquiryMessages', { id: { equals: relationId(moderationCase.targetMessage) } })
        : moderationCase.targetType === 'attachment'
          ? await findOne(req, 'inquiryMessages', {
              id: {
                equals: relationId(
                  (
                    await findOne(req, 'inquiryAttachments', {
                      id: { equals: relationId(moderationCase.targetAttachment) },
                    })
                  )?.boundMessage,
                ),
              },
            })
          : null
    const id =
      message?.authorKind === 'patient' ? relationId(message.authorPatient) : relationId(message?.authorClinicStaff)
    if (!message || id === null) {
      throw new InquiryModerationServiceError('invalid-state', 'The reported content author is unavailable.')
    }
    return { id, kind: message.authorKind === 'patient' ? 'patient' : 'clinic' }
  }
  const affected = input.affectedActor
  if (!affected) throw new InquiryModerationServiceError('invalid-input', 'The affected participant is required.')
  if (affected.kind === 'patient' && String(affected.id) === String(relationId(moderationCase.patient))) {
    return { id: payloadId(affected.id), kind: 'patient' }
  }
  if (affected.kind === 'clinic') {
    const staff = await findOne(req, 'clinicStaff', {
      and: [{ id: { equals: payloadId(affected.id) } }, { clinic: { equals: relationId(moderationCase.clinic) } }],
    })
    if (staff) return { id: staff.id, kind: 'clinic' }
  }
  throw new InquiryModerationServiceError('invalid-input', 'The affected participant is outside the case scope.')
}

const updateInquiryModerationActivity = async (
  req: PayloadRequest,
  moderationCase: StoredRecord,
  actor: { id: RelationId; kind?: 'platform' | 'system' },
  eventType: 'moderation-restored' | 'moderation-restricted',
  toValue: string,
): Promise<void> => {
  const scope = await caseScope(req, moderationCase)
  const nextSequence = Number(scope.inquiry.activitySequence ?? 0) + 1
  const now = new Date().toISOString()
  const updatedInquiry = asRecord(
    await req.payload.update({
      collection: 'patientClinicInquiries',
      context: { inquiryModerationCommand: true },
      data: {
        activitySequence: nextSequence,
        lastActivityAt: now,
        revision: Number(scope.inquiry.revision ?? 0) + 1,
      },
      depth: 0,
      id: scope.inquiry.id,
      overrideAccess: true,
      req,
    } as never),
  )
  await req.payload.create({
    collection: 'inquiryAuditEvents' as never,
    data: {
      actorId: String(actor.id),
      actorKind: actor.kind ?? 'platform',
      clinic: scope.clinicId,
      clinicNotificationSequence: Number(updatedInquiry.clinicNotificationSequence ?? 0),
      eventType,
      inquiry: updatedInquiry.id,
      sequence: nextSequence,
      targetId: text(moderationCase.targetId),
      targetType: text(moderationCase.targetType),
      toValue,
    },
    depth: 0,
    overrideAccess: true,
    req,
  } as never)
}

export const decideInquiryModerationCase = async (
  req: PayloadRequest,
  rawInput: InquiryModerationDecisionInput,
): Promise<{ decided: true }> => {
  const parsed = inquiryModerationDecisionInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryModerationServiceError('invalid-input', 'The moderation decision is invalid.')
  const input = parsed.data
  const initialModerator = await resolveModerator(req)
  await runCommandTransaction(req, async () => {
    const moderator = await resolveModerator(req)
    if (moderator.key !== initialModerator.key) {
      throw new InquiryModerationServiceError('access-denied', 'The moderation actor changed.')
    }
    const moderationCase = await readModerationCase(req, input.caseId)
    if (moderationCase.status !== 'open') {
      throw new InquiryModerationServiceError('invalid-state', 'The moderation case is already decided.')
    }
    if (input.outcome === 'content-restricted' && moderationCase.targetType === 'conversation') {
      throw new InquiryModerationServiceError('invalid-input', 'A conversation cannot use a content-only restriction.')
    }
    if (input.effectiveUntil && Date.parse(input.effectiveUntil) <= Date.now()) {
      throw new InquiryModerationServiceError('invalid-input', 'A moderation measure end must be in the future.')
    }
    const affected = await affectedActorForDecision(req, moderationCase, input)
    const now = new Date().toISOString()
    const updatedCase = await updateCaseAndCreateEvent(
      req,
      moderationCase,
      { id: moderator.id, kind: 'platform' },
      'decision-recorded',
      {
        affectedActorKind: affected?.kind ?? null,
        affectedClinicStaff: affected?.kind === 'clinic' ? affected.id : null,
        affectedPatient: affected?.kind === 'patient' ? affected.id : null,
        decisionAt: now,
        decisionBy: moderator.id,
        decisionCategory: input.category,
        decisionOutcome: input.outcome,
        decisionReason: input.reason,
        effectiveUntil: input.effectiveUntil ?? null,
        finalOutcomeAt: input.outcome === 'no-action' ? now : null,
        status: input.outcome === 'no-action' ? 'resolved' : 'decided',
      },
      { reason: input.reason, toValue: input.outcome },
    )
    if (input.outcome !== 'no-action') {
      await updateInquiryModerationActivity(req, updatedCase, moderator, 'moderation-restricted', input.outcome)
    }
    return updatedCase
  })
  return { decided: true }
}

const activeMeasure = (moderationCase: StoredRecord, now: number): boolean => {
  const outcome = text(moderationCase.decisionOutcome)
  if (!['content-restricted', 'conversation-restricted', 'identity-messaging-suspended'].includes(outcome)) return false
  if (moderationCase.appealOutcome === 'overturned') return false
  if (moderationCase.measureEndedAt) return false
  const effectiveUntil = text(moderationCase.effectiveUntil)
  return !effectiveUntil || Date.parse(effectiveUntil) > now
}

const participantAffectedByCase = (moderationCase: StoredRecord, participant: Reporter): boolean =>
  moderationCase.affectedActorKind === participant.kind &&
  String(
    relationId(participant.kind === 'patient' ? moderationCase.affectedPatient : moderationCase.affectedClinicStaff),
  ) === String(participant.id)

export const submitInquiryModerationAppeal = async (
  req: PayloadRequest,
  rawInput: InquiryModerationAppealInput,
): Promise<{ submitted: true }> => {
  const parsed = inquiryModerationAppealInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryModerationServiceError('invalid-input', 'The appeal input is invalid.')
  const input = parsed.data
  const initialParticipant = await resolveReporter(req)
  await runCommandTransaction(req, async () => {
    const participant = await resolveReporter(req)
    if (participant.key !== initialParticipant.key) {
      throw new InquiryModerationServiceError('access-denied', 'The appeal actor changed.')
    }
    const moderationCase = await readModerationCase(req, input.caseId)
    if (!participantAffectedByCase(moderationCase, participant)) {
      throw new InquiryModerationServiceError('not-found', 'The moderation case does not exist.')
    }
    if (
      moderationCase.status !== 'decided' ||
      moderationCase.appealedAt ||
      !activeMeasure(moderationCase, Date.now())
    ) {
      throw new InquiryModerationServiceError('invalid-state', 'An appeal is not available for this case.')
    }
    await updateCaseAndCreateEvent(
      req,
      moderationCase,
      { id: participant.id, kind: participant.kind },
      'appeal-submitted',
      {
        appealActorKind: participant.kind,
        appealClinicStaff: participant.kind === 'clinic' ? participant.id : null,
        appealOutcome: 'pending',
        appealPatient: participant.kind === 'patient' ? participant.id : null,
        appealText: input.text,
        appealedAt: new Date().toISOString(),
        status: 'appealed',
      },
    )
  })
  return { submitted: true }
}

export const decideInquiryModerationAppeal = async (
  req: PayloadRequest,
  rawInput: InquiryModerationAppealDecisionInput,
): Promise<{ decided: true }> => {
  const parsed = inquiryModerationAppealDecisionInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryModerationServiceError('invalid-input', 'The appeal decision is invalid.')
  const input = parsed.data
  const initialModerator = await resolveModerator(req)
  await runCommandTransaction(req, async () => {
    const moderator = await resolveModerator(req)
    if (moderator.key !== initialModerator.key) {
      throw new InquiryModerationServiceError('access-denied', 'The moderation actor changed.')
    }
    const moderationCase = await readModerationCase(req, input.caseId)
    if (moderationCase.status !== 'appealed' || moderationCase.appealOutcome !== 'pending') {
      throw new InquiryModerationServiceError('invalid-state', 'The appeal is not pending.')
    }
    const now = new Date().toISOString()
    const existingMeasureEndedAt = text(moderationCase.measureEndedAt)
    const updatedCase = await updateCaseAndCreateEvent(
      req,
      moderationCase,
      { id: moderator.id, kind: 'platform' },
      'appeal-decided',
      {
        appealDecidedAt: now,
        appealDecidedBy: moderator.id,
        appealDecisionReason: input.reason,
        appealOutcome: input.outcome,
        finalOutcomeAt: now,
        ...(input.outcome === 'overturned' ? { measureEndedAt: existingMeasureEndedAt || now } : {}),
        status: 'resolved',
      },
      { reason: input.reason, toValue: input.outcome },
    )
    if (input.outcome === 'overturned' && !existingMeasureEndedAt) {
      await updateInquiryModerationActivity(req, updatedCase, moderator, 'moderation-restored', 'available')
    }
  })
  return { decided: true }
}

export const reconcileExpiredInquiryModerationMeasures = async (
  req: PayloadRequest,
  input: { inquiryId: RelationId; now?: Date },
): Promise<{ reconciled: number }> => {
  const now = input.now ?? new Date()
  const candidates = await findMany(req, 'inquiryModerationCases', {
    and: [
      { inquiry: { equals: input.inquiryId } },
      { decisionAt: { exists: true } },
      { effectiveUntil: { less_than: now.toISOString() } },
      { measureEndedAt: { exists: false } },
    ],
  })
  let reconciled = 0
  for (const candidate of candidates.slice(0, 50)) {
    await runCommandTransaction(req, async () => {
      const moderationCase = await readModerationCase(req, String(candidate.id))
      const effectiveUntil = text(moderationCase.effectiveUntil)
      if (
        moderationCase.measureEndedAt ||
        moderationCase.appealOutcome === 'overturned' ||
        !effectiveUntil ||
        Date.parse(effectiveUntil) >= now.getTime() ||
        !['content-restricted', 'conversation-restricted', 'identity-messaging-suspended'].includes(
          text(moderationCase.decisionOutcome),
        )
      ) {
        return
      }
      const appealPending = moderationCase.status === 'appealed' && moderationCase.appealOutcome === 'pending'
      const ended = await updateCaseAndCreateEvent(
        req,
        moderationCase,
        { id: 'system', kind: 'system' },
        'measure-ended',
        {
          ...(!appealPending ? { finalOutcomeAt: now.toISOString(), status: 'resolved' } : {}),
          measureEndedAt: now.toISOString(),
        },
        { toValue: 'available' },
      )
      await updateInquiryModerationActivity(
        req,
        ended,
        { id: 'system', kind: 'system' },
        'moderation-restored',
        'available',
      )
      reconciled += 1
    })
  }
  return { reconciled }
}

export type InquiryModerationState = {
  moderation: InquiryModerationDTO
  restrictedAttachmentIds: Set<string>
  restrictedAttachments: Map<string, InquiryContentModerationDTO>
  restrictedMessageIds: Set<string>
  restrictedMessages: Map<string, InquiryContentModerationDTO>
}

const appealProjection = (moderationCase: StoredRecord) => ({
  caseId: String(moderationCase.id),
  state: !moderationCase.appealedAt
    ? ('available' as const)
    : moderationCase.appealOutcome === 'pending'
      ? ('submitted' as const)
      : ('unavailable' as const),
})

const affectedCurrentActor = (
  moderationCase: StoredRecord,
  actor: { id: RelationId; kind: 'clinic' | 'patient' },
): boolean =>
  moderationCase.affectedActorKind === actor.kind &&
  String(relationId(actor.kind === 'patient' ? moderationCase.affectedPatient : moderationCase.affectedClinicStaff)) ===
    String(actor.id)

const contentProjection = (
  moderationCase: StoredRecord,
  actor: { id: RelationId; kind: 'clinic' | 'patient' },
): InquiryContentModerationDTO => {
  const affected = affectedCurrentActor(moderationCase, actor)
  return {
    ...(affected ? { appeal: appealProjection(moderationCase) } : {}),
    ...(affected ? { category: text(moderationCase.decisionCategory) } : {}),
    ...(affected && text(moderationCase.effectiveUntil) ? { effectiveUntil: text(moderationCase.effectiveUntil) } : {}),
    isCurrentActorAffected: affected,
  }
}

export const readInquiryModerationState = async (
  req: PayloadRequest,
  inquiryId: RelationId,
  actor: { id: RelationId; kind: 'clinic' | 'patient' },
): Promise<InquiryModerationState> => {
  const now = Date.now()
  const inquiryCases = await findMany(req, 'inquiryModerationCases', {
    and: [{ inquiry: { equals: inquiryId } }, { decisionAt: { exists: true } }],
  })
  const actorIdentityCases = await findMany(req, 'inquiryModerationCases', {
    and: [
      { decisionAt: { exists: true } },
      { decisionOutcome: { equals: 'identity-messaging-suspended' } },
      actor.kind === 'patient'
        ? { affectedPatient: { equals: actor.id } }
        : { affectedClinicStaff: { equals: actor.id } },
    ],
  })
  const cases = inquiryCases.filter((moderationCase) => activeMeasure(moderationCase, now))
  const identityCases = actorIdentityCases.filter((moderationCase) => activeMeasure(moderationCase, now))
  const restrictedMessageIds = new Set<string>()
  const restrictedAttachmentIds = new Set<string>()
  const restrictedMessages = new Map<string, InquiryContentModerationDTO>()
  const restrictedAttachments = new Map<string, InquiryContentModerationDTO>()
  for (const moderationCase of cases) {
    if (moderationCase.decisionOutcome !== 'content-restricted') continue
    if (moderationCase.targetType === 'message') {
      const id = String(relationId(moderationCase.targetMessage))
      restrictedMessageIds.add(id)
      restrictedMessages.set(id, contentProjection(moderationCase, actor))
    }
    if (moderationCase.targetType === 'attachment') {
      const id = String(relationId(moderationCase.targetAttachment))
      restrictedAttachmentIds.add(id)
      restrictedAttachments.set(id, contentProjection(moderationCase, actor))
    }
  }
  const conversationCase =
    cases.find(
      (moderationCase) =>
        moderationCase.decisionOutcome === 'conversation-restricted' && affectedCurrentActor(moderationCase, actor),
    ) ?? cases.find((moderationCase) => moderationCase.decisionOutcome === 'conversation-restricted')
  const identityCase = identityCases.find(
    (moderationCase) =>
      moderationCase.decisionOutcome === 'identity-messaging-suspended' && affectedCurrentActor(moderationCase, actor),
  )
  const conversationAffected = conversationCase ? affectedCurrentActor(conversationCase, actor) : false
  return {
    moderation: {
      conversation: conversationCase
        ? {
            ...(conversationAffected ? { appeal: appealProjection(conversationCase) } : {}),
            ...(conversationAffected ? { category: text(conversationCase.decisionCategory) } : {}),
            ...(conversationAffected && text(conversationCase.effectiveUntil)
              ? { effectiveUntil: text(conversationCase.effectiveUntil) }
              : {}),
            isCurrentActorAffected: conversationAffected,
            state: 'restricted',
          }
        : { state: 'available' },
      identity: identityCase
        ? {
            appeal: appealProjection(identityCase),
            category: text(identityCase.decisionCategory),
            ...(text(identityCase.effectiveUntil) ? { effectiveUntil: text(identityCase.effectiveUntil) } : {}),
            isCurrentActorAffected: true,
            state: 'messaging-suspended',
          }
        : { state: 'available' },
    },
    restrictedAttachmentIds,
    restrictedAttachments,
    restrictedMessageIds,
    restrictedMessages,
  }
}
