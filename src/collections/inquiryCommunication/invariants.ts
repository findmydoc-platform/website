import { ValidationError, type CollectionBeforeValidateHook, type PayloadRequest } from 'payload'

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

const candidate = (data: unknown, originalDoc: unknown): RecordValue => ({
  ...((originalDoc && typeof originalDoc === 'object' ? originalDoc : {}) as RecordValue),
  ...((data && typeof data === 'object' ? data : {}) as RecordValue),
})

const fail = (req: PayloadRequest, collection: string, path: string, message: string): never => {
  throw new ValidationError({
    collection,
    errors: [{ path, message }],
    req,
  })
}

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

const validateInquiryScope = async (
  req: PayloadRequest,
  collection: string,
  record: RecordValue,
): Promise<RecordValue> => {
  const inquiry = await findRecord(req, 'patientClinicInquiries', record.inquiry)
  if (!inquiry) return fail(req, collection, 'inquiry', 'The inquiry does not exist.')
  if (!sameId(record.clinic, inquiry.clinic)) {
    fail(req, collection, 'clinic', 'The clinic must match the inquiry.')
  }
  return inquiry
}

const validateClinicActor = async (
  req: PayloadRequest,
  collection: string,
  clinic: unknown,
  staffId: unknown,
  path: string,
): Promise<void> => {
  const staff = await findRecord(req, 'clinicStaff', staffId)
  if (!staff || !sameId(staff.clinic, clinic)) {
    fail(req, collection, path, 'The clinic actor must belong to the inquiry clinic.')
  }
}

export const validateInquiryConversation: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const record = candidate(data, originalDoc)
  const inquiry = await validateInquiryScope(req, 'inquiryConversations', record)
  if (!inquiry.patient || !sameId(record.patient, inquiry.patient)) {
    fail(req, 'inquiryConversations', 'patient', 'A conversation requires the inquiry-bound patient.')
  }
  const expectedActorKey = `patients:${String(relationId(record.patient))}`
  if (record.actorKey !== expectedActorKey) {
    fail(req, 'inquiryConversations', 'actorKey', 'The conversation actor binding is invalid.')
  }
  return data
}

export const validateInquiryMessage: CollectionBeforeValidateHook = async ({ data, originalDoc, req, operation }) => {
  const record = candidate(data, originalDoc)
  const inquiry = await validateInquiryScope(req, 'inquiryMessages', record)
  if (!inquiry.patient || !sameId(record.patient, inquiry.patient)) {
    fail(req, 'inquiryMessages', 'patient', 'The message patient must match the inquiry.')
  }
  const conversation = await findRecord(req, 'inquiryConversations', record.conversation)
  if (
    !conversation ||
    !sameId(conversation.inquiry, record.inquiry) ||
    !sameId(conversation.clinic, record.clinic) ||
    !sameId(conversation.patient, record.patient)
  ) {
    fail(req, 'inquiryMessages', 'conversation', 'The conversation does not match the inquiry participants.')
  }

  const messageText = typeof record.text === 'string' ? record.text : ''
  if (!messageText.trim() && !record.attachment) {
    fail(req, 'inquiryMessages', 'text', 'A message needs text or one attachment.')
  }

  if (record.authorKind === 'patient') {
    if (!sameId(record.authorPatient, record.patient) || record.authorClinicStaff) {
      fail(req, 'inquiryMessages', 'authorPatient', 'The patient author binding is invalid.')
    }
    if (record.actorKey !== `patients:${String(relationId(record.patient))}`) {
      fail(req, 'inquiryMessages', 'actorKey', 'The patient actor key is invalid.')
    }
  } else if (record.authorKind === 'clinic') {
    if (!record.authorClinicStaff || record.authorPatient) {
      fail(req, 'inquiryMessages', 'authorClinicStaff', 'The clinic author binding is invalid.')
    }
    await validateClinicActor(req, 'inquiryMessages', record.clinic, record.authorClinicStaff, 'authorClinicStaff')
    if (record.actorKey !== `clinicStaff:${String(relationId(record.authorClinicStaff))}`) {
      fail(req, 'inquiryMessages', 'actorKey', 'The clinic actor key is invalid.')
    }
  } else {
    fail(req, 'inquiryMessages', 'authorKind', 'A message needs one valid author kind.')
  }

  if (record.attachment) {
    const attachment = await findRecord(req, 'inquiryAttachments', record.attachment)
    if (
      !attachment ||
      !sameId(attachment.inquiry, record.inquiry) ||
      !sameId(attachment.clinic, record.clinic) ||
      !sameId(attachment.patient, record.patient) ||
      attachment.actorKey !== record.actorKey ||
      (operation === 'create' && attachment.state !== 'verified')
    ) {
      fail(req, 'inquiryMessages', 'attachment', 'The attachment is not an unused verified draft for this actor.')
    }
  }
  if (
    operation === 'create' &&
    (Number(record.sequence) !== Number(inquiry.activitySequence ?? 0) + 1 ||
      Number(record.externalSequence) !== Number(inquiry.externalSequence ?? 0) + 1 ||
      Number(record.clinicNotificationSequence) !==
        Number(inquiry.clinicNotificationSequence ?? 0) + (record.authorKind === 'patient' ? 1 : 0))
  ) {
    fail(req, 'inquiryMessages', 'sequence', 'The message sequence must advance the inquiry exactly once.')
  }

  return data
}

export const validateInquiryInternalNote: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  const record = candidate(data, originalDoc)
  const inquiry = await validateInquiryScope(req, 'inquiryInternalNotes', record)
  const noteText = typeof record.text === 'string' ? record.text : ''
  if (!noteText.trim()) fail(req, 'inquiryInternalNotes', 'text', 'An internal note needs text.')
  await validateClinicActor(req, 'inquiryInternalNotes', record.clinic, record.authorClinicStaff, 'authorClinicStaff')
  if (record.actorKey !== `clinicStaff:${String(relationId(record.authorClinicStaff))}`) {
    fail(req, 'inquiryInternalNotes', 'actorKey', 'The clinic actor key is invalid.')
  }
  if (
    operation === 'create' &&
    (Number(record.sequence) !== Number(inquiry.activitySequence ?? 0) + 1 ||
      Number(record.clinicNotificationSequence) !== Number(inquiry.clinicNotificationSequence ?? 0) + 1)
  ) {
    fail(req, 'inquiryInternalNotes', 'sequence', 'The note sequence must advance the inquiry exactly once.')
  }
  return data
}

const attachmentTransitions = {
  draft: ['draft', 'verified', 'discarded'],
  verified: ['verified', 'bound', 'discarded'],
  bound: ['bound'],
  discarded: ['discarded'],
} as const

export const validateInquiryAttachment: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  const record = candidate(data, originalDoc)
  const inquiry = await validateInquiryScope(req, 'inquiryAttachments', record)
  if (!inquiry.patient || !sameId(record.patient, inquiry.patient)) {
    fail(req, 'inquiryAttachments', 'patient', 'The attachment patient must match the inquiry.')
  }

  if (record.ownerKind === 'patient') {
    if (!sameId(record.ownerPatient, record.patient) || record.ownerClinicStaff) {
      fail(req, 'inquiryAttachments', 'ownerPatient', 'The patient attachment owner is invalid.')
    }
    if (record.actorKey !== `patients:${String(relationId(record.patient))}`) {
      fail(req, 'inquiryAttachments', 'actorKey', 'The attachment actor key is invalid.')
    }
  } else if (record.ownerKind === 'clinic') {
    if (!record.ownerClinicStaff || record.ownerPatient) {
      fail(req, 'inquiryAttachments', 'ownerClinicStaff', 'The clinic attachment owner is invalid.')
    }
    await validateClinicActor(req, 'inquiryAttachments', record.clinic, record.ownerClinicStaff, 'ownerClinicStaff')
    if (record.actorKey !== `clinicStaff:${String(relationId(record.ownerClinicStaff))}`) {
      fail(req, 'inquiryAttachments', 'actorKey', 'The attachment actor key is invalid.')
    }
  } else {
    fail(req, 'inquiryAttachments', 'ownerKind', 'The attachment needs one valid owner kind.')
  }

  if (operation === 'update' && originalDoc) {
    const previousReadyObjectKey = (originalDoc as RecordValue).readyObjectKey
    if (previousReadyObjectKey && String(previousReadyObjectKey) !== String(record.readyObjectKey)) {
      fail(req, 'inquiryAttachments', 'readyObjectKey', 'The sealed attachment object cannot be replaced.')
    }
    for (const field of ['cleanupCompletedAt', 'draftCleanupCompletedAt'] as const) {
      const previous = (originalDoc as RecordValue)[field]
      if (previous && String(previous) !== String(record[field])) {
        fail(req, 'inquiryAttachments', field, 'Completed attachment cleanup cannot be changed.')
      }
    }
    const previous = (originalDoc as RecordValue).state
    const next = record.state
    if (
      typeof previous !== 'string' ||
      typeof next !== 'string' ||
      !(previous in attachmentTransitions) ||
      !attachmentTransitions[previous as keyof typeof attachmentTransitions].includes(next as never)
    ) {
      fail(req, 'inquiryAttachments', 'state', 'The attachment state transition is invalid.')
    }
  }

  if (record.state === 'verified' || record.state === 'bound') {
    if (
      !record.verifiedMimeType ||
      !record.verifiedSizeBytes ||
      !record.readyObjectKey ||
      record.verifiedMimeType !== record.declaredMimeType ||
      record.verifiedSizeBytes !== record.declaredSizeBytes
    ) {
      fail(req, 'inquiryAttachments', 'state', 'A verified attachment needs server-verified metadata.')
    }
  }
  if (record.state === 'bound') {
    const message = await findRecord(req, 'inquiryMessages', record.boundMessage)
    if (
      !message ||
      !sameId(message.inquiry, record.inquiry) ||
      !sameId(message.clinic, record.clinic) ||
      !sameId(message.patient, record.patient) ||
      !sameId(message.attachment, record.id)
    ) {
      fail(req, 'inquiryAttachments', 'boundMessage', 'A bound attachment needs its matching message.')
    }
  } else if (record.boundMessage) {
    fail(req, 'inquiryAttachments', 'boundMessage', 'Only a bound attachment may reference a message.')
  }
  if (record.cleanupCompletedAt && record.state !== 'discarded') {
    fail(req, 'inquiryAttachments', 'cleanupCompletedAt', 'Only a discarded attachment can be fully cleaned.')
  }
  if (record.cleanupCompletedAt && !record.draftCleanupCompletedAt) {
    fail(req, 'inquiryAttachments', 'draftCleanupCompletedAt', 'Full cleanup must include the draft object.')
  }
  if (record.draftCleanupCompletedAt && record.state === 'draft') {
    fail(req, 'inquiryAttachments', 'draftCleanupCompletedAt', 'An active draft cannot be marked as cleaned.')
  }
  return data
}

export const validateInquiryReadPosition: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const record = candidate(data, originalDoc)
  const inquiry = await validateInquiryScope(req, 'inquiryReadPositions', record)
  if (record.readerKind === 'patient') {
    if (!inquiry.patient || !sameId(record.readerPatient, inquiry.patient) || record.readerClinicStaff) {
      fail(req, 'inquiryReadPositions', 'readerPatient', 'The patient read position is invalid.')
    }
    if (record.readerKey !== `patients:${String(relationId(record.readerPatient))}`) {
      fail(req, 'inquiryReadPositions', 'readerKey', 'The patient reader key is invalid.')
    }
    if (record.forcedUnread === true) {
      fail(req, 'inquiryReadPositions', 'forcedUnread', 'Patients cannot mark an inquiry unread.')
    }
    if (Number(record.forcedUnreadEpoch ?? 0) !== 0) {
      fail(req, 'inquiryReadPositions', 'forcedUnreadEpoch', 'Patients cannot hold a clinic unread epoch.')
    }
    if (Number(record.lastReadSequence) > Number(inquiry.externalSequence ?? 0)) {
      fail(req, 'inquiryReadPositions', 'lastReadSequence', 'The patient read position is not visible.')
    }
  } else if (record.readerKind === 'clinic') {
    if (!record.readerClinicStaff || record.readerPatient) {
      fail(req, 'inquiryReadPositions', 'readerClinicStaff', 'The clinic read position is invalid.')
    }
    await validateClinicActor(req, 'inquiryReadPositions', record.clinic, record.readerClinicStaff, 'readerClinicStaff')
    if (record.readerKey !== `clinicStaff:${String(relationId(record.readerClinicStaff))}`) {
      fail(req, 'inquiryReadPositions', 'readerKey', 'The clinic reader key is invalid.')
    }
    if (Number(record.lastReadSequence) > Number(inquiry.clinicNotificationSequence ?? 0)) {
      fail(req, 'inquiryReadPositions', 'lastReadSequence', 'The clinic read position is not visible.')
    }
    if (Number(record.forcedUnreadEpoch ?? 0) > Number(inquiry.clinicUnreadEpoch ?? 0)) {
      fail(req, 'inquiryReadPositions', 'forcedUnreadEpoch', 'The clinic unread epoch is not visible.')
    }
  } else {
    fail(req, 'inquiryReadPositions', 'readerKind', 'The read position needs one valid reader kind.')
  }
  if (originalDoc && Number(record.lastReadSequence) < Number((originalDoc as RecordValue).lastReadSequence ?? 0)) {
    fail(req, 'inquiryReadPositions', 'lastReadSequence', 'Read positions cannot move backwards.')
  }

  if (record.lastReadActivityId) {
    const match = /^(message|note|event):(.+)$/u.exec(String(record.lastReadActivityId))
    if (!match?.[1] || !match[2] || (record.readerKind === 'patient' && match[1] !== 'message')) {
      fail(req, 'inquiryReadPositions', 'lastReadActivityId', 'The read activity does not match the read position.')
    }
    if (!match?.[1] || !match[2]) return data
    const collection =
      match[1] === 'message' ? 'inquiryMessages' : match[1] === 'note' ? 'inquiryInternalNotes' : 'inquiryAuditEvents'
    const activity = await findRecord(req, collection, match[2])
    const visibleActivity = [activity].find((candidateActivity) => {
      if (!candidateActivity || !sameId(candidateActivity.inquiry, record.inquiry)) return false
      if (
        match[1] === 'event' &&
        !['handling-status-changed', 'closed', 'reopened', 'marked-spam', 'spam-removed'].includes(
          String(candidateActivity.eventType),
        )
      ) {
        return false
      }
      const visibleSequence =
        record.readerKind === 'patient'
          ? candidateActivity.externalSequence
          : candidateActivity.clinicNotificationSequence
      return Number(visibleSequence) === Number(record.lastReadSequence)
    })
    if (!visibleActivity) {
      fail(req, 'inquiryReadPositions', 'lastReadActivityId', 'The read activity does not match the read position.')
    }
  }
  return data
}

export const validateInquiryAuditEvent: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const record = candidate(data, originalDoc)
  const inquiry = await validateInquiryScope(req, 'inquiryAuditEvents', record)
  if (typeof record.actorId !== 'string' || !record.actorId.trim()) {
    fail(req, 'inquiryAuditEvents', 'actorId', 'The audit actor is required.')
  }
  if (record.actorKind === 'patient') {
    if (!inquiry.patient || String(relationId(inquiry.patient)) !== record.actorId) {
      fail(req, 'inquiryAuditEvents', 'actorId', 'The audit patient does not match the inquiry.')
    }
  } else if (record.actorKind === 'clinic') {
    await validateClinicActor(req, 'inquiryAuditEvents', record.clinic, record.actorId, 'actorId')
  } else if (record.actorKind === 'system') {
    if (record.actorId !== 'system') fail(req, 'inquiryAuditEvents', 'actorId', 'The system actor is invalid.')
  } else if (record.actorKind === 'platform') {
    const platformActor = await findRecord(req, 'platformStaff', record.actorId)
    const capabilities = Array.isArray(platformActor?.capabilities) ? platformActor.capabilities : []
    if (!platformActor || !capabilities.includes('conversation-moderation')) {
      fail(req, 'inquiryAuditEvents', 'actorId', 'The moderation platform actor is invalid.')
    }
  } else {
    fail(req, 'inquiryAuditEvents', 'actorKind', 'The audit actor kind is not available for this domain.')
  }
  if (
    !Number.isInteger(Number(record.sequence)) ||
    Number(record.sequence) < 0 ||
    Number(record.sequence) > Number(inquiry.activitySequence ?? 0) ||
    !Number.isInteger(Number(record.clinicNotificationSequence)) ||
    Number(record.clinicNotificationSequence) < 0 ||
    Number(record.clinicNotificationSequence) > Number(inquiry.clinicNotificationSequence ?? 0)
  ) {
    fail(req, 'inquiryAuditEvents', 'sequence', 'The audit sequence must reference current inquiry activity.')
  }
  return data
}
