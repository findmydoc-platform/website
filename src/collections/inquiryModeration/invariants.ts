import { ValidationError, type CollectionBeforeValidateHook, type PayloadRequest } from 'payload'

import { hasInquiryPackageHardDeleteBarrier } from '@/features/inquiryAggregate/tombstones'

type RecordValue = Record<string, unknown>
type RelationId = number | string

const relationId = (value: unknown): RelationId | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && 'id' in value) return relationId((value as { id?: unknown }).id)
  return null
}

const sameId = (left: unknown, right: unknown): boolean => {
  const leftId = relationId(left)
  const rightId = relationId(right)
  return leftId !== null && rightId !== null && String(leftId) === String(rightId)
}

const bothRelationsMissing = (left: unknown, right: unknown): boolean =>
  relationId(left) === null && relationId(right) === null

const candidate = (data: unknown, originalDoc: unknown): RecordValue => ({
  ...((originalDoc && typeof originalDoc === 'object' ? originalDoc : {}) as RecordValue),
  ...((data && typeof data === 'object' ? data : {}) as RecordValue),
})

const fail = (req: PayloadRequest, collection: string, path: string, message: string): never => {
  throw new ValidationError({ collection, errors: [{ message, path }], req })
}

const isInquiryIdentityScrub = (req: PayloadRequest): boolean =>
  req.context?.inquiryRetentionCommand === true &&
  req.context?.inquiryRetentionScrub === true &&
  req.context?.inquiryIdentityScrub === true

const findRecord = async (req: PayloadRequest, collection: string, id: unknown): Promise<RecordValue | null> => {
  const resolvedId = relationId(id)
  if (resolvedId === null) return null
  const result = await req.payload.find({
    collection: collection as never,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: { id: { equals: resolvedId } },
  } as never)
  return (result.docs[0] as RecordValue | undefined) ?? null
}

const validateScope = async (req: PayloadRequest, collection: string, record: RecordValue) => {
  const inquiry =
    (await findRecord(req, 'patientClinicInquiries', record.inquiry)) ??
    fail(req, collection, 'inquiry', 'The inquiry does not exist.')
  const identityDeleted = inquiry.retentionState === 'anonymized' || inquiry.retentionState === 'hard-deleted'
  if (
    inquiry.retentionState === 'hard-deleted' ||
    (await hasInquiryPackageHardDeleteBarrier(req, inquiry.id as RelationId))
  ) {
    fail(req, collection, 'inquiry', 'The inquiry package has been hard deleted.')
  }
  const patientScopeMatches = identityDeleted
    ? bothRelationsMissing(record.patient, inquiry.patient)
    : sameId(record.patient, inquiry.patient)
  if (!sameId(record.clinic, inquiry.clinic) || !patientScopeMatches) {
    fail(req, collection, 'inquiry', 'The moderation scope must match the inquiry participants.')
  }
  const conversation =
    (await findRecord(req, 'inquiryConversations', record.conversation)) ??
    fail(req, collection, 'conversation', 'The moderation conversation does not match the inquiry.')
  if (
    !sameId(conversation.inquiry, inquiry.id) ||
    !sameId(conversation.clinic, record.clinic) ||
    !(identityDeleted
      ? bothRelationsMissing(conversation.patient, record.patient)
      : sameId(conversation.patient, record.patient))
  ) {
    fail(req, collection, 'conversation', 'The moderation conversation does not match the inquiry.')
  }
  return { conversation, identityDeleted, inquiry }
}

const validateClinicActor = async (
  req: PayloadRequest,
  collection: string,
  clinic: unknown,
  staffId: unknown,
  path: string,
) => {
  const staff = await findRecord(req, 'clinicStaff', staffId)
  if (!staff || !sameId(staff.clinic, clinic)) {
    fail(req, collection, path, 'The clinic actor must belong to the inquiry clinic.')
  }
}

export const validateInquiryModerationCase: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (isInquiryIdentityScrub(req)) return data
  const record = candidate(data, originalDoc)
  const { conversation, identityDeleted } = await validateScope(req, 'inquiryModerationCases', record)
  if (
    operation === 'update' &&
    Number(record.eventSequence) !== Number((originalDoc as RecordValue).eventSequence) + 1
  ) {
    fail(
      req,
      'inquiryModerationCases',
      'eventSequence',
      'A moderation case update must append exactly one audit event.',
    )
  }

  if (record.reporterKind === 'patient') {
    if (
      identityDeleted
        ? relationId(record.reporterPatient) !== null || relationId(record.reporterClinicStaff) !== null
        : !sameId(record.reporterPatient, record.patient) || relationId(record.reporterClinicStaff) !== null
    ) {
      fail(req, 'inquiryModerationCases', 'reporterPatient', 'The patient reporter binding is invalid.')
    }
    if (
      identityDeleted
        ? record.reporterKey !== null && record.reporterKey !== undefined
        : record.reporterKey !== `patients:${String(relationId(record.patient))}`
    ) {
      fail(req, 'inquiryModerationCases', 'reporterKey', 'The patient reporter key is invalid.')
    }
  } else if (record.reporterKind === 'clinic') {
    if (!record.reporterClinicStaff || record.reporterPatient) {
      fail(req, 'inquiryModerationCases', 'reporterClinicStaff', 'The clinic reporter binding is invalid.')
    }
    await validateClinicActor(
      req,
      'inquiryModerationCases',
      record.clinic,
      record.reporterClinicStaff,
      'reporterClinicStaff',
    )
    if (record.reporterKey !== `clinicStaff:${String(relationId(record.reporterClinicStaff))}`) {
      fail(req, 'inquiryModerationCases', 'reporterKey', 'The clinic reporter key is invalid.')
    }
  } else {
    fail(req, 'inquiryModerationCases', 'reporterKind', 'A moderation case needs one participant reporter.')
  }

  if (record.targetType === 'conversation') {
    if (!sameId(record.targetId, conversation.id) || record.targetMessage || record.targetAttachment) {
      fail(req, 'inquiryModerationCases', 'targetId', 'The conversation report target is invalid.')
    }
  } else if (record.targetType === 'message') {
    const message = await findRecord(req, 'inquiryMessages', record.targetMessage)
    if (
      !message ||
      !sameId(message.inquiry, record.inquiry) ||
      !sameId(record.targetId, message.id) ||
      record.targetAttachment ||
      (record.reporterKind === 'patient' && message.authorKind !== 'clinic') ||
      (record.reporterKind === 'clinic' && message.authorKind !== 'patient')
    ) {
      fail(req, 'inquiryModerationCases', 'targetMessage', 'The message report target is invalid.')
    }
  } else if (record.targetType === 'attachment') {
    const attachment = await findRecord(req, 'inquiryAttachments', record.targetAttachment)
    const message = attachment?.boundMessage ? await findRecord(req, 'inquiryMessages', attachment.boundMessage) : null
    if (
      !attachment ||
      !message ||
      attachment.state !== 'bound' ||
      !sameId(attachment.inquiry, record.inquiry) ||
      !sameId(record.targetId, attachment.id) ||
      record.targetMessage ||
      (record.reporterKind === 'patient' && message.authorKind !== 'clinic') ||
      (record.reporterKind === 'clinic' && message.authorKind !== 'patient')
    ) {
      fail(req, 'inquiryModerationCases', 'targetAttachment', 'The attachment report target is invalid.')
    }
  } else {
    fail(req, 'inquiryModerationCases', 'targetType', 'The moderation target is invalid.')
  }

  if (record.category === 'other' && !(typeof record.description === 'string' && record.description.trim())) {
    fail(req, 'inquiryModerationCases', 'description', 'Other reports need a short description.')
  }
  return data
}

export const validateInquiryModerationEvent: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (isInquiryIdentityScrub(req)) return data
  const record = candidate(data, originalDoc)
  await validateScope(req, 'inquiryModerationEvents', record)
  const moderationCase =
    (await findRecord(req, 'inquiryModerationCases', record.moderationCase)) ??
    fail(req, 'inquiryModerationEvents', 'moderationCase', 'The moderation event case is invalid.')
  if (!sameId(moderationCase.inquiry, record.inquiry)) {
    fail(req, 'inquiryModerationEvents', 'moderationCase', 'The moderation event case is invalid.')
  }
  if (
    !Number.isInteger(Number(record.sequence)) ||
    Number(record.sequence) < 1 ||
    (operation === 'create' && Number(record.sequence) !== Number(moderationCase.eventSequence))
  ) {
    fail(req, 'inquiryModerationEvents', 'sequence', 'The moderation event sequence is invalid.')
  }
  if (record.actorKind === 'patient' && !sameId(record.actorId, record.patient)) {
    fail(req, 'inquiryModerationEvents', 'actorId', 'The moderation patient actor is invalid.')
  }
  if (record.actorKind === 'clinic') {
    await validateClinicActor(req, 'inquiryModerationEvents', record.clinic, record.actorId, 'actorId')
  }
  if (record.actorKind === 'platform') {
    const platformActor = await findRecord(req, 'platformStaff', record.actorId)
    const capabilities = Array.isArray(platformActor?.capabilities) ? platformActor.capabilities : []
    if (!platformActor || !capabilities.includes('conversation-moderation')) {
      fail(req, 'inquiryModerationEvents', 'actorId', 'The moderation platform actor is invalid.')
    }
  }
  if (record.actorKind === 'system' && record.actorId !== 'system') {
    fail(req, 'inquiryModerationEvents', 'actorId', 'The moderation system actor is invalid.')
  }
  return data
}
