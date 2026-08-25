import { createHash, randomUUID } from 'node:crypto'
import type { PayloadRequest } from 'payload'

import type {
  AttachmentDraftCreateInput,
  AttachmentDraftDTO,
  AttachmentDraftMutationInput,
  AttachmentFinalizeDTO,
  ClinicInquiryQueueInput,
  ExternalMessageInput,
  GuestInquiryCreateInput,
  InquiryDetailDTO,
  InquiryDetailInput,
  InquiryDetailResultDTO,
  InquiryContactRevealDTO,
  InquiryListItemDTO,
  LegacyInquiryStatus,
  LegacyPatientClinicInquiryDTO,
  InquiryMutationResultDTO,
  InquiryQueueDTO,
  InquiryReadPositionInput,
  InquiryStateInput,
  InternalNoteInput,
  PatientInquiryQueueDTO,
  PatientInquiryQueueInput,
  VerifiedInquiryCreateInput,
} from './contracts'
import {
  attachmentDraftCreateInputSchema,
  attachmentDraftMutationInputSchema,
  clinicInquiryQueueInputSchema,
  externalMessageInputSchema,
  guestInquiryCreateInputSchema,
  INQUIRY_ATTACHMENT_MAX_BYTES,
  INQUIRY_ATTACHMENT_MIME_TYPES,
  inquiryReadPositionInputSchema,
  inquiryDetailInputSchema,
  inquiryStateInputSchema,
  isAllowedClinicHandlingStatusTransition,
  internalNoteInputSchema,
  patientInquiryQueueInputSchema,
  verifiedInquiryCreateInputSchema,
} from './contracts'
import {
  createS3InquiryAttachmentStorage,
  type InquiryAttachmentMimeType,
  type InquiryAttachmentStorageGateway,
} from './storage'

export type InquiryCommunicationServiceErrorKind =
  | 'access-denied'
  | 'conflict'
  | 'invalid-input'
  | 'invalid-state'
  | 'not-found'
  | 'payload-too-large'
  | 'rate-limited'
  | 'reauthentication-required'
  | 'service-timeout'
  | 'unavailable'
  | 'unsupported-media-type'
  | 'unauthorized'

export class InquiryCommunicationServiceError extends Error {
  constructor(
    readonly kind: InquiryCommunicationServiceErrorKind,
    message: string,
    readonly current?: InquiryDetailDTO,
  ) {
    super(message)
    this.name = 'InquiryCommunicationServiceError'
  }
}

type RelationId = number | string
type StoredRecord = Record<string, unknown> & { id: RelationId; createdAt?: string; updatedAt?: string }

type InquiryActor =
  | { id: RelationId; key: string; kind: 'patient' }
  | {
      clinicDisplayName: string
      clinicId: RelationId
      displayName: string
      id: RelationId
      key: string
      kind: 'clinic'
    }

const relationId = (value: unknown): RelationId | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (value && typeof value === 'object' && 'id' in value) return relationId((value as { id?: unknown }).id)
  return null
}

const payloadId = (value: string | number): RelationId => {
  if (typeof value === 'number') return value
  if (!/^[1-9]\d*$/u.test(value)) return value
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) ? numeric : value
}

const asRecord = (value: unknown): StoredRecord => value as StoredRecord

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const numberValue = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const actorKey = (req: PayloadRequest): string => {
  const user = req.user
  if (!user) {
    throw new InquiryCommunicationServiceError('unauthorized', 'An authenticated inquiry participant is required.')
  }
  if (user.collection !== 'patients' && user.collection !== 'clinicStaff') {
    throw new InquiryCommunicationServiceError('access-denied', 'An inquiry participant is required.')
  }
  return `${user.collection}:${String(user.id)}`
}

const patientId = (req: PayloadRequest): RelationId => {
  if (!req.user) {
    throw new InquiryCommunicationServiceError('unauthorized', 'A patient session is required.')
  }
  if (req.user.collection !== 'patients') {
    throw new InquiryCommunicationServiceError('access-denied', 'A patient session is required.')
  }
  return req.user.id
}

const requestHash = (input: unknown): string => createHash('sha256').update(JSON.stringify(input)).digest('hex')

const messageRequestHash = (input: ExternalMessageInput): string =>
  requestHash({
    attachmentDraftId: input.attachmentDraftId ?? null,
    inquiryId: input.inquiryId,
    text: input.text ?? null,
  })

const noteRequestHash = (input: InternalNoteInput): string =>
  requestHash({ inquiryId: input.inquiryId, text: input.text })

const duplicateConstraint = (error: unknown): boolean => {
  const pending: unknown[] = [error]
  const visited = new Set<unknown>()
  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || typeof current !== 'object' || visited.has(current)) continue
    visited.add(current)
    const record = current as Record<string, unknown>
    if (record.code === '23505') return true
    if (typeof record.message === 'string' && /duplicate|unique/iu.test(record.message)) return true
    for (const nested of [record.cause, record.data, record.errors]) {
      if (Array.isArray(nested)) pending.push(...nested)
      else if (nested) pending.push(nested)
    }
  }
  return false
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

const runCommandTransaction = async <Result>(req: PayloadRequest, command: () => Promise<Result>): Promise<Result> => {
  if (typeof req.transactionID !== 'undefined') {
    throw new InquiryCommunicationServiceError('unavailable', 'Inquiry commands cannot join another transaction.')
  }

  let transactionID: null | number | string = null
  const previousCommandContext = req.context?.inquiryCommunicationCommand
  try {
    req.context = { ...(req.context ?? {}), inquiryCommunicationCommand: true }
    transactionID = await req.payload.db.beginTransaction({ accessMode: 'read write', isolationLevel: 'serializable' })
    if (transactionID === null) {
      throw new InquiryCommunicationServiceError('unavailable', 'An inquiry transaction could not be started.')
    }
    req.transactionID = transactionID
    const result = await command()
    await req.payload.db.commitTransaction(transactionID)
    return result
  } catch (error: unknown) {
    if (transactionID !== null) {
      try {
        await req.payload.db.rollbackTransaction(transactionID)
      } catch (rollbackError: unknown) {
        throw new AggregateError([error, rollbackError], 'Inquiry command and rollback both failed.')
      }
    }
    if (isSerializationFailure(error)) {
      throw new InquiryCommunicationServiceError('conflict', 'The inquiry changed concurrently.')
    }
    throw error
  } finally {
    if (transactionID !== null && req.transactionID === transactionID) delete req.transactionID
    if (typeof previousCommandContext === 'undefined') {
      delete req.context?.inquiryCommunicationCommand
    } else {
      req.context = { ...(req.context ?? {}), inquiryCommunicationCommand: previousCommandContext }
    }
  }
}

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
  options?: { limit?: number; sort?: string },
): Promise<StoredRecord[]> => {
  const docs: StoredRecord[] = []
  let page = 1
  while (docs.length < (options?.limit ?? Number.POSITIVE_INFINITY)) {
    const remaining = (options?.limit ?? Number.POSITIVE_INFINITY) - docs.length
    const result = await req.payload.find({
      collection: collection as never,
      depth: 0,
      limit: Math.min(100, remaining),
      overrideAccess: true,
      page,
      pagination: true,
      req,
      sort: options?.sort ?? 'createdAt',
      where,
    } as never)
    docs.push(...result.docs.map(asRecord))
    if (!result.hasNextPage) break
    page += 1
  }
  return docs
}

const updateInquiry = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  data: Record<string, unknown>,
): Promise<StoredRecord> =>
  asRecord(
    await req.payload.update({
      collection: 'patientClinicInquiries',
      context: { inquiryCommunicationCommand: true },
      data,
      depth: 0,
      id: inquiry.id,
      overrideAccess: true,
      req,
    } as never),
  )

const createAuditEvent = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  actor: InquiryActor | { id: string; kind: 'system' },
  eventType: string,
  sequence: number,
  options?: { fromValue?: string; reason?: string; targetId?: string; targetType?: string; toValue?: string },
): Promise<StoredRecord> =>
  asRecord(
    await req.payload.create({
      collection: 'inquiryAuditEvents' as never,
      data: {
        actorId: String(actor.id),
        actorKind: actor.kind,
        clinic: relationId(inquiry.clinic),
        clinicNotificationSequence: numberValue(inquiry.clinicNotificationSequence, 1),
        eventType,
        sequence,
        ...(options?.fromValue ? { fromValue: options.fromValue } : {}),
        inquiry: inquiry.id,
        ...(options?.reason ? { reason: options.reason } : {}),
        ...(options?.targetId ? { targetId: options.targetId } : {}),
        ...(options?.targetType ? { targetType: options.targetType } : {}),
        ...(options?.toValue ? { toValue: options.toValue } : {}),
      },
      depth: 0,
      overrideAccess: true,
      req,
    } as never),
  )

const activityId = (kind: 'event' | 'message' | 'note', id: RelationId): string => `${kind}:${String(id)}`

const readPosition = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  actor: InquiryActor,
): Promise<StoredRecord | null> =>
  findOne(req, 'inquiryReadPositions', {
    and: [{ inquiry: { equals: inquiry.id } }, { readerKey: { equals: actor.key } }],
  })

const writeReadPosition = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  actor: InquiryActor,
  values: { forcedUnread: boolean; lastReadActivityId?: string | null; lastReadSequence: number },
): Promise<StoredRecord> => {
  const existing = await readPosition(req, inquiry, actor)
  const data = {
    clinic: relationId(inquiry.clinic),
    forcedUnread: values.forcedUnread,
    forcedUnreadEpoch: actor.kind === 'clinic' ? numberValue(inquiry.clinicUnreadEpoch) : 0,
    inquiry: inquiry.id,
    lastReadActivityId: values.lastReadActivityId ?? null,
    lastReadSequence: values.lastReadSequence,
    readerClinicStaff: actor.kind === 'clinic' ? actor.id : null,
    readerKey: actor.key,
    readerKind: actor.kind,
    readerPatient: actor.kind === 'patient' ? actor.id : null,
  }
  if (existing) {
    return asRecord(
      await req.payload.update({
        collection: 'inquiryReadPositions' as never,
        data,
        depth: 0,
        id: existing.id,
        overrideAccess: true,
        req,
      } as never),
    )
  }
  return asRecord(
    await req.payload.create({
      collection: 'inquiryReadPositions' as never,
      data,
      depth: 0,
      overrideAccess: true,
      req,
    } as never),
  )
}

const resolveCurrentActor = async (req: PayloadRequest): Promise<InquiryActor> => {
  if (!req.user) throw new InquiryCommunicationServiceError('unauthorized', 'Authentication is required.')

  if (req.user.collection === 'patients') {
    const patient = await findOne(req, 'patients', { id: { equals: req.user.id } })
    if (!patient) throw new InquiryCommunicationServiceError('unauthorized', 'The patient session is unavailable.')
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
      throw new InquiryCommunicationServiceError('access-denied', 'The clinic principal is not access-ready.')
    }
    const clinic = await findOne(req, 'clinics', {
      and: [{ id: { equals: clinicId } }, { status: { equals: 'approved' } }],
    })
    if (!clinic) throw new InquiryCommunicationServiceError('access-denied', 'The clinic is not access-ready.')
    const displayName = [text(staff.firstName), text(staff.lastName)].filter(Boolean).join(' ') || text(staff.email)
    return {
      clinicDisplayName: text(clinic.name),
      clinicId,
      displayName,
      id: staff.id,
      key: `clinicStaff:${String(staff.id)}`,
      kind: 'clinic',
    }
  }

  throw new InquiryCommunicationServiceError('access-denied', 'The principal cannot access inquiry communication.')
}

const readAuthorizedInquiry = async (
  req: PayloadRequest,
  inquiryId: string,
  actor: InquiryActor,
): Promise<StoredRecord> => {
  const scope = actor.kind === 'patient' ? { patient: { equals: actor.id } } : { clinic: { equals: actor.clinicId } }
  const inquiry = await findOne(req, 'patientClinicInquiries', {
    and: [{ id: { equals: payloadId(inquiryId) } }, scope],
  })
  if (!inquiry) throw new InquiryCommunicationServiceError('not-found', 'The inquiry does not exist.')
  return inquiry
}

const validateInquiryTarget = async (
  req: PayloadRequest,
  input: { clinicId: number | string; doctorId?: number | string; treatmentId?: number | string },
): Promise<void> => {
  const clinicId = payloadId(input.clinicId)
  const clinic = await findOne(req, 'clinics', {
    and: [{ id: { equals: clinicId } }, { status: { equals: 'approved' } }],
  })
  if (!clinic) throw new InquiryCommunicationServiceError('not-found', 'The clinic does not exist.')

  if (input.doctorId) {
    const doctor = await findOne(req, 'doctors', {
      and: [
        { id: { equals: payloadId(input.doctorId) } },
        { clinic: { equals: clinicId } },
        { active: { equals: true } },
      ],
    })
    if (!doctor) {
      throw new InquiryCommunicationServiceError('invalid-input', 'Doctor is not available for this clinic.')
    }
  }

  if (input.treatmentId) {
    const treatment = await findOne(req, 'clinictreatments', {
      and: [
        { clinic: { equals: clinicId } },
        { treatment: { equals: payloadId(input.treatmentId) } },
        { active: { equals: true } },
      ],
    })
    if (!treatment) {
      throw new InquiryCommunicationServiceError('invalid-input', 'Treatment is not available for this clinic.')
    }
  }
}

const findCreationReplay = async (
  req: PayloadRequest,
  ownerId: RelationId,
  input: VerifiedInquiryCreateInput,
): Promise<StoredRecord | null> => {
  const inquiry = await findOne(req, 'patientClinicInquiries', {
    and: [{ patient: { equals: ownerId } }, { creationIdempotencyKey: { equals: input.idempotencyKey } }],
  })
  if (!inquiry) return null
  if (text(inquiry.creationRequestHash) !== requestHash(input)) {
    throw new InquiryCommunicationServiceError('conflict', 'The idempotency key was already used for other input.')
  }
  return inquiry
}

const readConversation = async (req: PayloadRequest, inquiryId: RelationId): Promise<StoredRecord | null> =>
  findOne(req, 'inquiryConversations', { inquiry: { equals: inquiryId } })

const readPatient = async (req: PayloadRequest, id: RelationId): Promise<StoredRecord> => {
  const patient = await findOne(req, 'patients', { id: { equals: id } })
  if (!patient) throw new InquiryCommunicationServiceError('not-found', 'The inquiry does not exist.')
  return patient
}

const buildInterest = async (req: PayloadRequest, inquiry: StoredRecord): Promise<InquiryDetailDTO['interest']> => {
  const treatmentId = relationId(inquiry.treatment)
  const doctorId = relationId(inquiry.doctor)
  const [treatment, doctor] = await Promise.all([
    treatmentId === null ? null : findOne(req, 'treatments', { id: { equals: treatmentId } }),
    doctorId === null ? null : findOne(req, 'doctors', { id: { equals: doctorId } }),
  ])
  const doctorName = doctor
    ? text(doctor.fullName) || [text(doctor.firstName), text(doctor.lastName)].filter(Boolean).join(' ')
    : ''
  const label = text(treatment?.name) || (doctorName ? `Consultation with ${doctorName}` : 'General clinic inquiry')

  return {
    ...(doctorId === null ? {} : { doctorId: String(doctorId) }),
    label,
    ...(text(inquiry.preferredContactWindow) ? { preferredContactWindow: text(inquiry.preferredContactWindow) } : {}),
    ...(treatmentId === null ? {} : { treatmentId: String(treatmentId) }),
    ...(text(inquiry.treatmentTimeline) ? { treatmentTimeline: text(inquiry.treatmentTimeline) } : {}),
  }
}

const buildClinicDescriptor = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
): Promise<InquiryDetailDTO['clinic']> => {
  const clinicId = relationId(inquiry.clinic)
  if (clinicId === null) throw new InquiryCommunicationServiceError('invalid-state', 'The clinic is unavailable.')
  const clinic = await findOne(req, 'clinics', { id: { equals: clinicId } })
  const displayName = text(clinic?.name)
  if (!clinic || !displayName) {
    throw new InquiryCommunicationServiceError('invalid-state', 'The clinic is unavailable.')
  }
  return { displayName, id: String(clinic.id) }
}

const legacyStatus = (inquiry: StoredRecord): LegacyInquiryStatus => {
  if (!isOperationalInquiry(inquiry)) {
    const storedStatus = text(inquiry.status)
    return ['submitted', 'in_review', 'contacted', 'closed', 'spam'].includes(storedStatus)
      ? (storedStatus as LegacyInquiryStatus)
      : 'submitted'
  }
  if (text(inquiry.handlingStatus) === 'spam') return 'spam'
  if (text(inquiry.lifecycle) === 'closed') return 'closed'
  const handlingStatus = text(inquiry.handlingStatus)
  return handlingStatus === 'in_review' || handlingStatus === 'contacted' ? handlingStatus : 'submitted'
}

const legacyEnumValue = <Value extends string>(value: unknown, allowed: readonly Value[]): Value | null => {
  const candidate = text(value)
  return allowed.includes(candidate as Value) ? (candidate as Value) : null
}

const maskEmail = (email: string): string => {
  const [localPart, domain] = email.split('@')
  if (!domain) return '••••••'
  return `${localPart?.slice(0, 1) || '•'}•••@${domain}`
}

const maskPhone = (phone: string): string => {
  const suffix = phone.replace(/\D/gu, '').slice(-4)
  return suffix ? `••••••${suffix}` : '••••••'
}

const buildLegacyInquiryDTO = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
): Promise<LegacyPatientClinicInquiryDTO> => {
  const treatmentId = relationId(inquiry.treatment)
  const treatment = treatmentId === null ? null : await findOne(req, 'treatments', { id: { equals: treatmentId } })
  const treatmentName = text(treatment?.name)
  const status = legacyStatus(inquiry)
  const contact =
    status === 'spam'
      ? { email: maskEmail(text(inquiry.email)), phoneNumber: maskPhone(text(inquiry.phoneNumber)) }
      : status === 'closed'
        ? { email: '', phoneNumber: '' }
        : { email: text(inquiry.email), phoneNumber: text(inquiry.phoneNumber) }
  return {
    createdAt: text(inquiry.createdAt),
    email: contact.email,
    fullName: text(inquiry.fullName),
    id: String(inquiry.id),
    message: text(inquiry.message),
    phoneNumber: contact.phoneNumber,
    preferredContactWindow: legacyEnumValue(inquiry.preferredContactWindow, [
      'as_soon_as_possible',
      'morning',
      'afternoon',
      'evening',
      'no_preference',
    ] as const),
    status,
    treatment:
      treatmentId === null
        ? null
        : treatmentName
          ? { id: String(treatmentId), name: treatmentName }
          : String(treatmentId),
    treatmentTimeline: legacyEnumValue(inquiry.treatmentTimeline, [
      'as_soon_as_possible',
      'within_two_weeks',
      'within_one_month',
      'flexible',
    ] as const),
    updatedAt: text(inquiry.updatedAt),
  }
}

const attachmentDTO = (attachment: StoredRecord | null) => {
  const mimeType = text(attachment?.verifiedMimeType)
  if (!attachment || !INQUIRY_ATTACHMENT_MIME_TYPES.includes(mimeType as never)) return undefined
  return {
    fileName: text(attachment.fileName),
    id: String(attachment.id),
    mimeType: mimeType as (typeof INQUIRY_ATTACHMENT_MIME_TYPES)[number],
    sizeBytes: numberValue(attachment.verifiedSizeBytes),
  }
}

const readTimeline = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  actor: InquiryActor,
): Promise<InquiryDetailDTO['timeline']> => {
  const [messages, notes, auditEvents] = await Promise.all([
    findMany(req, 'inquiryMessages', { inquiry: { equals: inquiry.id } }),
    actor.kind === 'clinic'
      ? findMany(req, 'inquiryInternalNotes', { inquiry: { equals: inquiry.id } })
      : Promise.resolve([]),
    actor.kind === 'clinic'
      ? findMany(req, 'inquiryAuditEvents', {
          and: [
            { inquiry: { equals: inquiry.id } },
            {
              eventType: {
                in: ['handling-status-changed', 'closed', 'reopened', 'marked-spam', 'spam-removed'],
              },
            },
          ],
        })
      : Promise.resolve([]),
  ])

  const items: Array<InquiryDetailDTO['timeline'][number] & { internalRank: number; internalSequence: number }> = []
  for (const message of messages) {
    const attachment = message.attachment
      ? await findOne(req, 'inquiryAttachments', { id: { equals: relationId(message.attachment) } })
      : null
    let displayName: string
    if (message.authorKind === 'patient') {
      displayName = actor.kind === 'patient' ? 'You' : text(inquiry.fullName)
    } else if (actor.kind === 'patient') {
      displayName = 'Clinic'
    } else {
      const staff = await findOne(req, 'clinicStaff', { id: { equals: relationId(message.authorClinicStaff) } })
      displayName =
        [text(staff?.firstName), text(staff?.lastName)].filter(Boolean).join(' ') || text(staff?.email) || 'Clinic'
    }

    items.push({
      actor: {
        displayName,
        isCurrentActor: message.actorKey === actor.key,
        kind: message.authorKind === 'patient' ? 'patient' : 'clinic',
      },
      ...(attachmentDTO(attachment) ? { attachment: attachmentDTO(attachment) } : {}),
      createdAt: text(message.createdAt),
      id: activityId('message', message.id),
      internalRank: 2,
      internalSequence: numberValue(message.sequence),
      kind: 'external-message',
      ...(text(message.text) ? { text: text(message.text) } : {}),
    })
  }

  for (const note of notes) {
    const staff = await findOne(req, 'clinicStaff', { id: { equals: relationId(note.authorClinicStaff) } })
    const displayName =
      [text(staff?.firstName), text(staff?.lastName)].filter(Boolean).join(' ') || text(staff?.email) || 'Clinic'
    items.push({
      actor: { displayName, isCurrentActor: note.actorKey === actor.key, kind: 'clinic' },
      createdAt: text(note.createdAt),
      id: activityId('note', note.id),
      internalRank: 2,
      internalSequence: numberValue(note.sequence),
      kind: 'internal-note',
      text: text(note.text),
    })
  }

  for (const event of auditEvents) {
    const eventType = text(event.eventType) as Extract<
      InquiryDetailDTO['timeline'][number],
      { kind: 'system-event' }
    >['event']
    const staff =
      event.actorKind === 'clinic'
        ? await findOne(req, 'clinicStaff', { id: { equals: payloadId(text(event.actorId)) } })
        : null
    const displayName = staff
      ? [text(staff.firstName), text(staff.lastName)].filter(Boolean).join(' ') || text(staff.email)
      : 'System'
    items.push({
      actor: {
        displayName,
        isCurrentActor: event.actorKind === 'clinic' && `clinicStaff:${text(event.actorId)}` === actor.key,
        kind: event.actorKind === 'clinic' ? 'clinic' : 'system',
      },
      createdAt: text(event.createdAt),
      event: eventType,
      id: activityId('event', event.id),
      internalRank: 1,
      internalSequence: numberValue(event.sequence),
      kind: 'system-event',
    })
  }

  return items
    .sort((left, right) => {
      const bySequence = left.internalSequence - right.internalSequence
      if (bySequence !== 0) return bySequence
      const byRank = left.internalRank - right.internalRank
      if (byRank !== 0) return byRank
      const byTime = left.createdAt.localeCompare(right.createdAt)
      if (byTime !== 0) return byTime
      return `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`)
    })
    .map(({ internalRank: _internalRank, internalSequence: _internalSequence, ...item }) => item)
}

const latestActivity = (
  inquiry: StoredRecord,
  timeline: InquiryDetailDTO['timeline'],
): { kind: InquiryDetailDTO['latestActivityKind']; preview: string } => {
  const latest = timeline.at(-1)
  if (!latest) return { kind: 'inquiry', preview: text(inquiry.message).slice(0, 160) }
  if (latest.kind === 'external-message') {
    return {
      kind: latest.kind,
      preview: (latest.text || latest.attachment?.fileName || 'Attachment').slice(0, 160),
    }
  }
  if (latest.kind === 'internal-note') return { kind: latest.kind, preview: latest.text.slice(0, 160) }
  const labels = {
    'handling-status-changed': 'Handling status changed',
    closed: 'Inquiry closed',
    reopened: 'Inquiry reopened',
    'marked-spam': 'Marked as spam',
    'spam-removed': 'Spam removed',
  } as const
  return { kind: latest.kind, preview: labels[latest.event] }
}

const operationalInquiryHandlingStatuses = new Set(['submitted', 'in_review', 'contacted', 'spam'])

const nonNegativeIntegerField = (value: unknown): boolean =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

const isOperationalInquiry = (inquiry: StoredRecord): boolean =>
  operationalInquiryHandlingStatuses.has(text(inquiry.handlingStatus)) &&
  (inquiry.lifecycle === 'open' || inquiry.lifecycle === 'closed') &&
  nonNegativeIntegerField(inquiry.revision) &&
  nonNegativeIntegerField(inquiry.activitySequence) &&
  nonNegativeIntegerField(inquiry.externalSequence) &&
  nonNegativeIntegerField(inquiry.clinicNotificationSequence) &&
  nonNegativeIntegerField(inquiry.clinicUnreadFloor) &&
  nonNegativeIntegerField(inquiry.clinicUnreadEpoch) &&
  Boolean(text(inquiry.lastActivityAt))

const assertOperationalInquiry = (inquiry: StoredRecord): void => {
  if (!isOperationalInquiry(inquiry)) {
    throw new InquiryCommunicationServiceError(
      'invalid-state',
      'This legacy inquiry is awaiting the communication cutover.',
    )
  }
}

const projectedHandlingStatus = (inquiry: StoredRecord): InquiryDetailDTO['handlingStatus'] => {
  if (operationalInquiryHandlingStatuses.has(text(inquiry.handlingStatus))) {
    return text(inquiry.handlingStatus) as InquiryDetailDTO['handlingStatus']
  }
  const legacyStatus = text(inquiry.status)
  return operationalInquiryHandlingStatuses.has(legacyStatus)
    ? (legacyStatus as InquiryDetailDTO['handlingStatus'])
    : 'submitted'
}

const projectedLifecycle = (inquiry: StoredRecord): InquiryDetailDTO['lifecycle'] => {
  if (inquiry.lifecycle === 'open' || inquiry.lifecycle === 'closed') return inquiry.lifecycle
  return inquiry.status === 'closed' || inquiry.status === 'spam' ? 'closed' : 'open'
}

const clinicUnreadProjection = (
  inquiry: StoredRecord,
  position: StoredRecord | null | undefined,
): InquiryDetailDTO['unread'] => {
  if (!isOperationalInquiry(inquiry)) return { count: 0, isUnread: false }
  const clinicNotificationSequence = numberValue(inquiry.clinicNotificationSequence, 1)
  const effectiveReadSequence = Math.max(
    numberValue(position?.lastReadSequence),
    numberValue(inquiry.clinicUnreadFloor),
  )
  const hasActiveForcedUnread =
    Boolean(position?.forcedUnread) &&
    numberValue(position?.forcedUnreadEpoch) >= numberValue(inquiry.clinicUnreadEpoch)
  const isUnread = hasActiveForcedUnread || clinicNotificationSequence > effectiveReadSequence

  return {
    count: Math.max(hasActiveForcedUnread ? 1 : 0, clinicNotificationSequence - effectiveReadSequence),
    isUnread,
    ...(text(position?.lastReadActivityId) ? { lastReadActivityId: text(position?.lastReadActivityId) } : {}),
  }
}

const buildPatientDetail = async (req: PayloadRequest, inquiry: StoredRecord): Promise<InquiryDetailDTO> => {
  const ownerId = relationId(inquiry.patient)
  if (ownerId === null) throw new InquiryCommunicationServiceError('not-found', 'The inquiry does not exist.')
  const conversation = await readConversation(req, inquiry.id)
  if (!conversation) throw new InquiryCommunicationServiceError('not-found', 'The inquiry does not exist.')
  const patient = await readPatient(req, ownerId)
  const actor = await resolveCurrentActor(req)
  if (actor.kind !== 'patient' || String(actor.id) !== String(ownerId)) {
    throw new InquiryCommunicationServiceError('not-found', 'The inquiry does not exist.')
  }
  assertOperationalInquiry(inquiry)
  const [clinic, interest, timeline] = await Promise.all([
    buildClinicDescriptor(req, inquiry),
    buildInterest(req, inquiry),
    readTimeline(req, inquiry, actor),
  ])
  const displayName =
    [text(patient.firstName), text(patient.lastName)].filter(Boolean).join(' ') || text(inquiry.fullName)
  const createdAt = text(inquiry.createdAt)
  const lastActivityAt = text(inquiry.lastExternalActivityAt) || createdAt
  const externalSequence = numberValue(inquiry.externalSequence)
  const position = await readPosition(req, inquiry, actor)
  const lastReadSequence = numberValue(position?.lastReadSequence)
  const patientIsUnread = externalSequence > lastReadSequence
  const latest = latestActivity(inquiry, timeline)
  const actualHandlingStatus = text(inquiry.handlingStatus) || 'submitted'
  const patientHandlingStatus =
    actualHandlingStatus === 'spam' ? text(inquiry.previousHandlingStatus) || 'submitted' : actualHandlingStatus

  return {
    actions: {
      canAddInternalNote: false,
      canChangeHandlingStatus: false,
      canChangeLifecycle: false,
      canMarkRead: patientIsUnread,
      canMarkUnread: false,
      canReply: text(inquiry.lifecycle) === 'open' && actualHandlingStatus !== 'spam',
      canRevealContact: false,
      canView: true,
    },
    attachmentConstraints: {
      acceptedMimeTypes: INQUIRY_ATTACHMENT_MIME_TYPES,
      maxFileBytes: INQUIRY_ATTACHMENT_MAX_BYTES,
      maxFilesPerMessage: 1,
    },
    binding: {
      canReply: text(inquiry.lifecycle) === 'open' && actualHandlingStatus !== 'spam',
      conversationId: String(conversation.id),
      kind: 'patient',
      patient: { displayName, id: String(ownerId) },
    },
    clinic,
    contact: {
      email: text(inquiry.email),
      mode: 'full',
      phoneNumber: text(inquiry.phoneNumber),
    },
    createdAt,
    handlingStatus: patientHandlingStatus as InquiryDetailDTO['handlingStatus'],
    id: String(inquiry.id),
    interest,
    lastActivityAt,
    latestActivityKind: latest.kind,
    lifecycle: (text(inquiry.lifecycle) || 'open') as InquiryDetailDTO['lifecycle'],
    originalRequest: {
      message: text(inquiry.message),
      ...(text(inquiry.preferredContactWindow) ? { preferredContactWindow: text(inquiry.preferredContactWindow) } : {}),
      ...(text(inquiry.treatmentTimeline) ? { treatmentTimeline: text(inquiry.treatmentTimeline) } : {}),
    },
    patientName: displayName,
    preview: latest.preview,
    revision: numberValue(inquiry.revision),
    timeline,
    unread: {
      count: Math.max(0, externalSequence - lastReadSequence),
      isUnread: patientIsUnread,
      ...(text(position?.lastReadActivityId) ? { lastReadActivityId: text(position?.lastReadActivityId) } : {}),
    },
  }
}

const buildClinicDetail = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  actor: Extract<InquiryActor, { kind: 'clinic' }>,
): Promise<InquiryDetailDTO> => {
  const ownerId = relationId(inquiry.patient)
  const operational = isOperationalInquiry(inquiry)
  const [clinic, conversation, interest, timeline, position] = await Promise.all([
    buildClinicDescriptor(req, inquiry),
    ownerId === null ? Promise.resolve(null) : readConversation(req, inquiry.id),
    buildInterest(req, inquiry),
    readTimeline(req, inquiry, actor),
    operational ? readPosition(req, inquiry, actor) : Promise.resolve(null),
  ])
  const createdAt = text(inquiry.createdAt)
  const lastActivityAt = text(inquiry.lastActivityAt) || createdAt
  const unread = clinicUnreadProjection(inquiry, position)
  const handlingStatus = projectedHandlingStatus(inquiry)
  const lifecycle = projectedLifecycle(inquiry)
  const canReply =
    operational && ownerId !== null && Boolean(conversation) && lifecycle === 'open' && handlingStatus !== 'spam'
  const binding: InquiryDetailDTO['binding'] =
    ownerId !== null && conversation
      ? {
          canReply,
          conversationId: String(conversation.id),
          kind: 'patient',
          patient: { displayName: text(inquiry.fullName), id: String(ownerId) },
        }
      : { canReply: false, kind: 'guest' }
  const latest = latestActivity(inquiry, timeline)
  const contact: InquiryDetailDTO['contact'] =
    handlingStatus === 'spam'
      ? {
          email: maskEmail(text(inquiry.email)),
          mode: 'masked',
          phoneNumber: maskPhone(text(inquiry.phoneNumber)),
        }
      : lifecycle === 'closed'
        ? { mode: 'collapsed' }
        : { email: text(inquiry.email), mode: 'full', phoneNumber: text(inquiry.phoneNumber) }

  return {
    actions: {
      canAddInternalNote: operational,
      canChangeHandlingStatus: operational,
      canChangeLifecycle: operational && handlingStatus !== 'spam',
      canMarkRead: operational && unread.isUnread,
      canMarkUnread: operational && !unread.isUnread,
      canReply,
      canRevealContact: operational && handlingStatus === 'spam',
      canView: true,
    },
    attachmentConstraints: {
      acceptedMimeTypes: INQUIRY_ATTACHMENT_MIME_TYPES,
      maxFileBytes: INQUIRY_ATTACHMENT_MAX_BYTES,
      maxFilesPerMessage: 1,
    },
    binding,
    clinic,
    contact,
    createdAt,
    handlingStatus,
    id: String(inquiry.id),
    interest,
    lastActivityAt,
    latestActivityKind: latest.kind,
    lifecycle,
    originalRequest: {
      message: text(inquiry.message),
      ...(text(inquiry.preferredContactWindow) ? { preferredContactWindow: text(inquiry.preferredContactWindow) } : {}),
      ...(text(inquiry.treatmentTimeline) ? { treatmentTimeline: text(inquiry.treatmentTimeline) } : {}),
    },
    patientName: text(inquiry.fullName),
    preview: latest.preview,
    revision: numberValue(inquiry.revision),
    timeline,
    unread,
  }
}

const toListItem = (detail: InquiryDetailDTO): InquiryListItemDTO => ({
  binding: detail.binding,
  clinic: detail.clinic,
  createdAt: detail.createdAt,
  handlingStatus: detail.handlingStatus,
  id: detail.id,
  interest: detail.interest,
  lastActivityAt: detail.lastActivityAt,
  latestActivityKind: detail.latestActivityKind,
  lifecycle: detail.lifecycle,
  patientName: detail.patientName,
  preview: detail.preview,
  revision: detail.revision,
  unread: detail.unread,
})

type QueueCursor = { id: string; lastActivityAt: string }

const encodeQueueCursor = (value: QueueCursor): string => Buffer.from(JSON.stringify(value)).toString('base64url')

const decodeQueueCursor = (value: string | undefined): QueueCursor | null => {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<QueueCursor>
    return typeof parsed.id === 'string' && typeof parsed.lastActivityAt === 'string'
      ? { id: parsed.id, lastActivityAt: parsed.lastActivityAt }
      : null
  } catch {
    return null
  }
}

const afterQueueCursor = (item: InquiryListItemDTO, cursor: QueueCursor | null): boolean => {
  if (!cursor) return true
  if (item.lastActivityAt < cursor.lastActivityAt) return true
  if (item.lastActivityAt > cursor.lastActivityAt) return false
  return item.id.localeCompare(cursor.id, undefined, { numeric: true }) < 0
}

const compareQueueItems = (left: InquiryListItemDTO, right: InquiryListItemDTO): number => {
  const byActivity = right.lastActivityAt.localeCompare(left.lastActivityAt)
  if (byActivity !== 0) return byActivity
  return right.id.localeCompare(left.id, undefined, { numeric: true })
}

const queueChangeCursor = (items: readonly InquiryListItemDTO[]): string =>
  requestHash(items.map((item) => [item.id, item.revision, item.lastActivityAt, item.unread]))

type ClinicQueueProbeMetadata = {
  conversationIdsByInquiry: ReadonlyMap<string, string>
  interestLabelsByInquiry: ReadonlyMap<string, string>
}

const loadClinicQueueProbeMetadata = async (
  req: PayloadRequest,
  inquiries: readonly StoredRecord[],
): Promise<ClinicQueueProbeMetadata> => {
  const doctorIds = [
    ...new Set(inquiries.map((inquiry) => relationId(inquiry.doctor)).filter((id): id is RelationId => id !== null)),
  ]
  const treatmentIds = [
    ...new Set(inquiries.map((inquiry) => relationId(inquiry.treatment)).filter((id): id is RelationId => id !== null)),
  ]
  const inquiryIds = inquiries.map((inquiry) => inquiry.id)
  const [doctors, treatments, conversations] = await Promise.all([
    doctorIds.length ? findMany(req, 'doctors', { id: { in: doctorIds } }) : Promise.resolve([]),
    treatmentIds.length ? findMany(req, 'treatments', { id: { in: treatmentIds } }) : Promise.resolve([]),
    inquiryIds.length ? findMany(req, 'inquiryConversations', { inquiry: { in: inquiryIds } }) : Promise.resolve([]),
  ])
  const doctorNames = new Map(
    doctors.map((doctor) => [
      String(doctor.id),
      text(doctor.fullName) || [text(doctor.firstName), text(doctor.lastName)].filter(Boolean).join(' '),
    ]),
  )
  const treatmentNames = new Map(treatments.map((treatment) => [String(treatment.id), text(treatment.name)]))
  const interestLabelsByInquiry = new Map(
    inquiries.map((inquiry) => {
      const treatmentId = relationId(inquiry.treatment)
      const doctorId = relationId(inquiry.doctor)
      const treatmentName = treatmentId === null ? '' : treatmentNames.get(String(treatmentId)) || ''
      const doctorName = doctorId === null ? '' : doctorNames.get(String(doctorId)) || ''
      return [
        String(inquiry.id),
        treatmentName || (doctorName ? `Consultation with ${doctorName}` : 'General clinic inquiry'),
      ] as const
    }),
  )
  const conversationIdsByInquiry = new Map(
    conversations.flatMap((conversation) => {
      const inquiryId = relationId(conversation.inquiry)
      return inquiryId === null ? [] : [[String(inquiryId), String(conversation.id)] as const]
    }),
  )
  return { conversationIdsByInquiry, interestLabelsByInquiry }
}

const clinicQueueProbeCursor = (
  actor: Extract<InquiryActor, { kind: 'clinic' }>,
  inquiries: readonly StoredRecord[],
  positionsByInquiry: ReadonlyMap<string, StoredRecord>,
  metadata: ClinicQueueProbeMetadata,
  input: ClinicInquiryQueueInput,
): string =>
  requestHash({
    actor: actor.key,
    clinic: { displayName: actor.clinicDisplayName, id: String(actor.clinicId) },
    filters: {
      cursor: input.cursor ?? null,
      handlingStatus: input.handlingStatus ? [...input.handlingStatus].sort() : null,
      lifecycle: input.lifecycle,
      limit: input.limit,
      query: input.query?.toLocaleLowerCase('en') ?? null,
      unreadOnly: input.unreadOnly,
    },
    inquiries: inquiries
      .map((inquiry) => [
        String(inquiry.id),
        text(inquiry.createdAt),
        text(inquiry.lastActivityAt),
        text(inquiry.handlingStatus),
        text(inquiry.lifecycle),
        numberValue(inquiry.revision),
        numberValue(inquiry.activitySequence),
        numberValue(inquiry.clinicNotificationSequence, 1),
        numberValue(inquiry.clinicUnreadFloor),
        numberValue(inquiry.clinicUnreadEpoch),
        relationId(inquiry.patient),
        text(inquiry.fullName),
        text(inquiry.message),
        relationId(inquiry.doctor),
        relationId(inquiry.treatment),
        text(inquiry.preferredContactWindow),
        text(inquiry.treatmentTimeline),
        metadata.interestLabelsByInquiry.get(String(inquiry.id)) ?? 'General clinic inquiry',
        metadata.conversationIdsByInquiry.get(String(inquiry.id)) ?? null,
        clinicUnreadProjection(inquiry, positionsByInquiry.get(String(inquiry.id))),
      ])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]), undefined, { numeric: true })),
  })

const detailChangeCursor = (detail: InquiryDetailDTO): string => requestHash(detail)

export const readClinicInquiryDetail = async (
  req: PayloadRequest,
  rawInput: InquiryDetailInput,
): Promise<InquiryDetailResultDTO> => {
  const parsed = inquiryDetailInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryCommunicationServiceError('invalid-input', 'The detail input is invalid.')
  const input = parsed.data
  const actor = await resolveCurrentActor(req)
  if (actor.kind !== 'clinic') throw new InquiryCommunicationServiceError('access-denied', 'Clinic access is required.')
  const inquiry = await readAuthorizedInquiry(req, input.inquiryId, actor)
  const detail = await buildClinicDetail(req, inquiry, actor)
  const changeCursor = detailChangeCursor(detail)
  return {
    changeCursor,
    inquiry: detail,
    unchanged: input.knownChangeCursor === changeCursor,
  }
}

export const readClinicInquiryQueue = async (
  req: PayloadRequest,
  rawInput: ClinicInquiryQueueInput,
): Promise<InquiryQueueDTO> => {
  const parsed = clinicInquiryQueueInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryCommunicationServiceError('invalid-input', 'The queue input is invalid.')
  const input = parsed.data
  const cursor = decodeQueueCursor(input.cursor)
  if (input.cursor && !cursor)
    throw new InquiryCommunicationServiceError('invalid-input', 'The queue cursor is invalid.')
  const actor = await resolveCurrentActor(req)
  if (actor.kind !== 'clinic') throw new InquiryCommunicationServiceError('access-denied', 'Clinic access is required.')

  const inquiries = await findMany(
    req,
    'patientClinicInquiries',
    { clinic: { equals: actor.clinicId } },
    { sort: '-lastActivityAt' },
  )
  const positions = await findMany(req, 'inquiryReadPositions', {
    and: [{ clinic: { equals: actor.clinicId } }, { readerKey: { equals: actor.key } }],
  })
  const positionsByInquiry = new Map(
    positions.flatMap((position) => {
      const inquiryId = relationId(position.inquiry)
      return inquiryId === null ? [] : [[String(inquiryId), position] as const]
    }),
  )
  const unreadCount = inquiries.filter(
    (inquiry) => clinicUnreadProjection(inquiry, positionsByInquiry.get(String(inquiry.id))).isUnread,
  ).length
  const metadata = await loadClinicQueueProbeMetadata(req, inquiries)
  const changeCursor = clinicQueueProbeCursor(actor, inquiries, positionsByInquiry, metadata, input)
  if (input.knownChangeCursor === changeCursor) {
    return {
      changeCursor,
      items: [],
      unchanged: true,
      unreadCount,
    }
  }

  const details = await Promise.all(inquiries.map((inquiry) => buildClinicDetail(req, inquiry, actor)))
  const query = input.query?.toLocaleLowerCase('en')
  const filteredItems = details
    .map(toListItem)
    .filter((item) => input.lifecycle === 'all' || item.lifecycle === input.lifecycle)
    .filter((item) => !input.handlingStatus?.length || input.handlingStatus.includes(item.handlingStatus))
    .filter((item) => !input.unreadOnly || item.unread.isUnread)
    .filter((item) => {
      if (!query) return true
      const detail = details.find((candidate) => candidate.id === item.id)
      const searchableTimeline = detail?.timeline
        .map((activity) => {
          if (activity.kind === 'external-message')
            return `${activity.text ?? ''} ${activity.attachment?.fileName ?? ''}`
          if (activity.kind === 'internal-note') return activity.text
          return ''
        })
        .join(' ')
      return [item.id, item.patientName, detail?.originalRequest.message, searchableTimeline]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('en')
        .includes(query)
    })
    .sort(compareQueueItems)
  const items = filteredItems.filter((item) => afterQueueCursor(item, cursor))
  const page = items.slice(0, input.limit)
  const last = page.at(-1)

  return {
    changeCursor,
    items: page,
    ...(last && items.length > page.length
      ? { nextCursor: encodeQueueCursor({ id: last.id, lastActivityAt: last.lastActivityAt }) }
      : {}),
    unchanged: false,
    unreadCount,
  }
}

export const readLegacyClinicInquiryQueue = async (
  req: PayloadRequest,
): Promise<{ docs: LegacyPatientClinicInquiryDTO[] }> => {
  const actor = await resolveCurrentActor(req)
  if (actor.kind !== 'clinic') throw new InquiryCommunicationServiceError('access-denied', 'Clinic access is required.')
  const inquiries = await findMany(
    req,
    'patientClinicInquiries',
    { clinic: { equals: actor.clinicId } },
    { limit: 100, sort: '-createdAt' },
  )
  return { docs: await Promise.all(inquiries.map((inquiry) => buildLegacyInquiryDTO(req, inquiry))) }
}

export const readLegacyClinicInquiryDetail = async (
  req: PayloadRequest,
  input: { inquiryId: string },
): Promise<LegacyPatientClinicInquiryDTO> => {
  const actor = await resolveCurrentActor(req)
  if (actor.kind !== 'clinic') throw new InquiryCommunicationServiceError('access-denied', 'Clinic access is required.')
  return buildLegacyInquiryDTO(req, await readAuthorizedInquiry(req, input.inquiryId, actor))
}

const legacyForwardTransitions = {
  submitted: ['in_review', 'contacted', 'closed'],
  in_review: ['contacted', 'closed'],
  contacted: ['closed'],
  closed: [],
  spam: [],
} as const satisfies Record<LegacyInquiryStatus, readonly LegacyInquiryStatus[]>

export const changeLegacyClinicInquiryStatus = async (
  req: PayloadRequest,
  input: { inquiryId: string; status: LegacyInquiryStatus },
): Promise<LegacyPatientClinicInquiryDTO> => {
  const initialActor = await resolveCurrentActor(req)
  if (initialActor.kind !== 'clinic') {
    throw new InquiryCommunicationServiceError('access-denied', 'Clinic access is required.')
  }
  if (input.status === 'spam') {
    throw new InquiryCommunicationServiceError('invalid-state', 'Spam requires the focused reason-bearing command.')
  }

  const updated = await runRetryableActorInquiryCommand(req, input.inquiryId, initialActor, async () => {
    const actor = await resolveCurrentActor(req)
    if (actor.kind !== 'clinic' || actor.key !== initialActor.key) {
      throw new InquiryCommunicationServiceError('access-denied', 'The clinic participant changed.')
    }
    const inquiry = await readAuthorizedInquiry(req, input.inquiryId, actor)
    assertOperationalInquiry(inquiry)
    const currentStatus = legacyStatus(inquiry)
    if (!legacyForwardTransitions[currentStatus].includes(input.status as never)) {
      throw new InquiryCommunicationServiceError('conflict', 'The legacy status transition is no longer available.')
    }

    const nextSequence = numberValue(inquiry.activitySequence, 1) + 1
    const closes = input.status === 'closed'
    const current = await updateInquiry(req, inquiry, {
      activitySequence: nextSequence,
      ...(closes ? { lifecycle: 'closed' } : { handlingStatus: input.status }),
      lastActivityAt: new Date().toISOString(),
      revision: numberValue(inquiry.revision) + 1,
    })
    await createAuditEvent(req, current, actor, closes ? 'closed' : 'handling-status-changed', nextSequence, {
      fromValue: closes ? text(inquiry.lifecycle) : text(inquiry.handlingStatus),
      targetId: String(current.id),
      targetType: 'inquiry',
      toValue: closes ? 'closed' : input.status,
    })
    return current
  })

  return buildLegacyInquiryDTO(req, updated)
}

export const readPatientInquiryQueue = async (
  req: PayloadRequest,
  rawInput: PatientInquiryQueueInput = {},
): Promise<PatientInquiryQueueDTO> => {
  const parsed = patientInquiryQueueInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryCommunicationServiceError('invalid-input', 'The queue input is invalid.')
  const input = parsed.data
  const actor = await resolveCurrentActor(req)
  if (actor.kind !== 'patient')
    throw new InquiryCommunicationServiceError('access-denied', 'Patient access is required.')
  const cursor = decodeQueueCursor(input.cursor)
  if (input.cursor && !cursor)
    throw new InquiryCommunicationServiceError('invalid-input', 'The queue cursor is invalid.')
  const inquiries = await findMany(
    req,
    'patientClinicInquiries',
    { patient: { equals: actor.id } },
    { sort: '-lastActivityAt' },
  )
  const allItems = (await Promise.all(inquiries.map((inquiry) => buildPatientDetail(req, inquiry))))
    .map(toListItem)
    .sort(compareQueueItems)
  const counts = {
    all: allItems.length,
    closed: allItems.filter((item) => item.lifecycle === 'closed').length,
    open: allItems.filter((item) => item.lifecycle === 'open').length,
  }
  const unreadCount = allItems.filter((item) => item.unread.isUnread).length
  const items = allItems
    .filter((item) => input.lifecycle === 'all' || item.lifecycle === input.lifecycle)
    .filter((item) => afterQueueCursor(item, cursor))
  const page = items.slice(0, input.limit)
  const last = page.at(-1)
  return {
    changeCursor: queueChangeCursor(allItems),
    counts,
    items: page,
    ...(last && items.length > page.length
      ? { nextCursor: encodeQueueCursor({ id: last.id, lastActivityAt: last.lastActivityAt }) }
      : {}),
    unchanged: false,
    unreadCount,
  }
}

const buildDetailForActor = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  actor: InquiryActor,
): Promise<InquiryDetailDTO> =>
  actor.kind === 'clinic' ? buildClinicDetail(req, inquiry, actor) : buildPatientDetail(req, inquiry)

const withActorSafeCurrent = async (
  req: PayloadRequest,
  inquiryId: string,
  actor: InquiryActor,
  error: unknown,
): Promise<unknown> => {
  if (
    !(error instanceof InquiryCommunicationServiceError) ||
    error.current ||
    (error.kind !== 'conflict' && error.kind !== 'invalid-state')
  ) {
    return error
  }
  try {
    const inquiry = await readAuthorizedInquiry(req, inquiryId, actor)
    return new InquiryCommunicationServiceError(
      error.kind,
      error.message,
      await buildDetailForActor(req, inquiry, actor),
    )
  } catch {
    return error
  }
}

const runActorInquiryCommand = async <Result>(
  req: PayloadRequest,
  inquiryId: string,
  actor: InquiryActor,
  command: () => Promise<Result>,
): Promise<Result> => {
  try {
    return await runCommandTransaction(req, command)
  } catch (error: unknown) {
    throw await withActorSafeCurrent(req, inquiryId, actor, error)
  }
}

const runRetryableActorInquiryCommand = async <Result>(
  req: PayloadRequest,
  inquiryId: string,
  actor: InquiryActor,
  command: () => Promise<Result>,
): Promise<Result> => {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await runCommandTransaction(req, command)
    } catch (error: unknown) {
      lastError = error
      if (
        !(
          error instanceof InquiryCommunicationServiceError &&
          error.kind === 'conflict' &&
          error.message === 'The inquiry changed concurrently.'
        ) ||
        attempt === 2
      ) {
        break
      }
    }
  }
  throw await withActorSafeCurrent(req, inquiryId, actor, lastError)
}

const assertExternalCommunicationOpen = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  actor: InquiryActor,
): Promise<StoredRecord> => {
  if (!isOperationalInquiry(inquiry)) {
    throw new InquiryCommunicationServiceError(
      'invalid-state',
      'This legacy inquiry is awaiting the communication cutover.',
      await buildDetailForActor(req, inquiry, actor),
    )
  }
  if (text(inquiry.lifecycle) !== 'open' || text(inquiry.handlingStatus) === 'spam') {
    throw new InquiryCommunicationServiceError(
      'invalid-state',
      'External communication is not available.',
      await buildDetailForActor(req, inquiry, actor),
    )
  }
  if (!inquiry.patient) {
    throw new InquiryCommunicationServiceError(
      'invalid-state',
      'Guest inquiries do not support external replies.',
      await buildDetailForActor(req, inquiry, actor),
    )
  }
  const conversation = await readConversation(req, inquiry.id)
  if (!conversation) {
    throw new InquiryCommunicationServiceError(
      'invalid-state',
      'The inquiry conversation is unavailable.',
      await buildDetailForActor(req, inquiry, actor),
    )
  }
  return conversation
}

const assertExpectedRevision = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  actor: InquiryActor,
  expectedRevision: number,
): Promise<void> => {
  if (numberValue(inquiry.revision) !== expectedRevision) {
    throw new InquiryCommunicationServiceError(
      'conflict',
      'The inquiry changed concurrently.',
      await buildDetailForActor(req, inquiry, actor),
    )
  }
}

const readMessageReplay = async (
  req: PayloadRequest,
  actor: InquiryActor,
  input: ExternalMessageInput,
): Promise<StoredRecord | null> => {
  const message = await findOne(req, 'inquiryMessages', {
    and: [
      { inquiry: { equals: payloadId(input.inquiryId) } },
      { actorKey: { equals: actor.key } },
      { idempotencyKey: { equals: input.idempotencyKey } },
    ],
  })
  if (message && text(message.requestHash) !== messageRequestHash(input)) {
    throw new InquiryCommunicationServiceError('conflict', 'The idempotency key was already used for other input.')
  }
  return message
}

const readNoteReplay = async (
  req: PayloadRequest,
  actor: Extract<InquiryActor, { kind: 'clinic' }>,
  input: InternalNoteInput,
): Promise<StoredRecord | null> => {
  const note = await findOne(req, 'inquiryInternalNotes', {
    and: [
      { inquiry: { equals: payloadId(input.inquiryId) } },
      { actorKey: { equals: actor.key } },
      { idempotencyKey: { equals: input.idempotencyKey } },
    ],
  })
  if (note && text(note.requestHash) !== noteRequestHash(input)) {
    throw new InquiryCommunicationServiceError('conflict', 'The idempotency key was already used for other input.')
  }
  return note
}

const verifiedAttachmentForActor = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  actor: InquiryActor,
  attachmentId: string,
): Promise<StoredRecord> => {
  const attachment = await findOne(req, 'inquiryAttachments', {
    and: [
      { id: { equals: payloadId(attachmentId) } },
      { inquiry: { equals: inquiry.id } },
      { actorKey: { equals: actor.key } },
      { state: { equals: 'verified' } },
    ],
  })
  if (!attachment) throw new InquiryCommunicationServiceError('not-found', 'The attachment does not exist.')
  return attachment
}

const sealedAttachmentArgs = (attachment: StoredRecord) => {
  const mimeType = text(attachment.verifiedMimeType)
  const readyObjectKey = text(attachment.readyObjectKey)
  const sizeBytes = numberValue(attachment.verifiedSizeBytes)
  if (!INQUIRY_ATTACHMENT_MIME_TYPES.includes(mimeType as never) || !readyObjectKey || sizeBytes <= 0) {
    throw new InquiryCommunicationServiceError('invalid-state', 'The attachment is not verified.')
  }
  return {
    expectedMimeType: mimeType as InquiryAttachmentMimeType,
    expectedSizeBytes: sizeBytes,
    readyObjectKey,
  }
}

const mapStorageError = (error: unknown): InquiryCommunicationServiceError => {
  const message = error instanceof Error ? error.message : ''
  if (/too large|size.*limit/iu.test(message)) {
    return new InquiryCommunicationServiceError('payload-too-large', 'The attachment is too large.')
  }
  if (/content type|media type|file name|invalid/iu.test(message)) {
    return new InquiryCommunicationServiceError('unsupported-media-type', 'The attachment is not supported.')
  }
  if (/does not match|changed|not verified/iu.test(message)) {
    return new InquiryCommunicationServiceError('invalid-state', 'The attachment could not be verified.')
  }
  return new InquiryCommunicationServiceError('unavailable', 'Attachment storage is temporarily unavailable.')
}

const sendInquiryMessage = async (
  req: PayloadRequest,
  rawInput: ExternalMessageInput,
  requiredActor: InquiryActor['kind'],
  storage?: InquiryAttachmentStorageGateway,
): Promise<InquiryMutationResultDTO> => {
  const parsed = externalMessageInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryCommunicationServiceError('invalid-input', 'The message input is invalid.')
  const input = parsed.data
  const initialActor = await resolveCurrentActor(req)
  if (initialActor.kind !== requiredActor) {
    throw new InquiryCommunicationServiceError('access-denied', `A ${requiredActor} participant is required.`)
  }

  let initialReplay: StoredRecord | null
  try {
    initialReplay = await readMessageReplay(req, initialActor, input)
  } catch (error: unknown) {
    throw await withActorSafeCurrent(req, input.inquiryId, initialActor, error)
  }
  if (initialReplay) {
    const inquiry = await readAuthorizedInquiry(req, input.inquiryId, initialActor)
    return { inquiry: await buildDetailForActor(req, inquiry, initialActor), replayed: true }
  }

  const initialInquiry = await readAuthorizedInquiry(req, input.inquiryId, initialActor)
  await assertExternalCommunicationOpen(req, initialInquiry, initialActor)
  const attachmentStorage = input.attachmentDraftId ? (storage ?? createS3InquiryAttachmentStorage()) : null
  let initialAttachment: StoredRecord | null = null
  if (input.attachmentDraftId) {
    initialAttachment = await verifiedAttachmentForActor(req, initialInquiry, initialActor, input.attachmentDraftId)
    try {
      await attachmentStorage?.verifySealed(sealedAttachmentArgs(initialAttachment))
    } catch (error: unknown) {
      throw mapStorageError(error)
    }
  }

  try {
    const updatedInquiry = await runRetryableActorInquiryCommand(req, input.inquiryId, initialActor, async () => {
      const actor = await resolveCurrentActor(req)
      if (actor.kind !== requiredActor || actor.key !== initialActor.key) {
        throw new InquiryCommunicationServiceError('access-denied', 'The inquiry participant changed.')
      }
      const replay = await readMessageReplay(req, actor, input)
      if (replay) return readAuthorizedInquiry(req, input.inquiryId, actor)

      const inquiry = await readAuthorizedInquiry(req, input.inquiryId, actor)
      const conversation = await assertExternalCommunicationOpen(req, inquiry, actor)
      await assertExpectedRevision(req, inquiry, actor, input.expectedRevision)
      const ownerId = relationId(inquiry.patient)
      const clinicId = relationId(inquiry.clinic)
      if (ownerId === null || clinicId === null) {
        throw new InquiryCommunicationServiceError('invalid-state', 'The inquiry participants are unavailable.')
      }
      const attachment = input.attachmentDraftId
        ? await verifiedAttachmentForActor(req, inquiry, actor, input.attachmentDraftId)
        : null
      if (attachment && initialAttachment && String(attachment.id) !== String(initialAttachment.id)) {
        throw new InquiryCommunicationServiceError('conflict', 'The attachment changed concurrently.')
      }
      if (attachment && attachmentStorage) {
        try {
          await attachmentStorage.verifySealed(sealedAttachmentArgs(attachment))
        } catch (error: unknown) {
          throw mapStorageError(error)
        }
      }

      const now = new Date().toISOString()
      const nextSequence = numberValue(inquiry.activitySequence, 1) + 1
      const nextExternalSequence = numberValue(inquiry.externalSequence) + 1
      const nextClinicNotificationSequence =
        numberValue(inquiry.clinicNotificationSequence, 1) + (actor.kind === 'patient' ? 1 : 0)
      const previousHandlingStatus = text(inquiry.handlingStatus) || 'submitted'
      const nextHandlingStatus =
        actor.kind === 'clinic' && (previousHandlingStatus === 'submitted' || previousHandlingStatus === 'in_review')
          ? 'contacted'
          : previousHandlingStatus

      const message = asRecord(
        await req.payload.create({
          collection: 'inquiryMessages' as never,
          data: {
            actorKey: actor.key,
            attachment: attachment?.id ?? null,
            authorClinicStaff: actor.kind === 'clinic' ? actor.id : null,
            authorKind: actor.kind,
            authorPatient: actor.kind === 'patient' ? actor.id : null,
            clinic: clinicId,
            clinicNotificationSequence: nextClinicNotificationSequence,
            conversation: conversation.id,
            externalSequence: nextExternalSequence,
            idempotencyKey: input.idempotencyKey,
            inquiry: inquiry.id,
            patient: ownerId,
            requestHash: messageRequestHash(input),
            sequence: nextSequence,
            text: input.text ?? null,
          },
          depth: 0,
          overrideAccess: true,
          req,
        } as never),
      )

      const current = await updateInquiry(req, inquiry, {
        activitySequence: nextSequence,
        clinicNotificationSequence: nextClinicNotificationSequence,
        externalSequence: nextExternalSequence,
        handlingStatus: nextHandlingStatus,
        lastActivityAt: now,
        lastExternalActivityAt: now,
        revision: numberValue(inquiry.revision) + 1,
      })
      if (attachment) {
        await req.payload.update({
          collection: 'inquiryAttachments' as never,
          data: { boundMessage: message.id, state: 'bound' },
          depth: 0,
          id: attachment.id,
          overrideAccess: true,
          req,
        } as never)
      }
      if (nextHandlingStatus !== previousHandlingStatus) {
        await createAuditEvent(req, current, actor, 'handling-status-changed', nextSequence, {
          fromValue: previousHandlingStatus,
          targetId: String(current.id),
          targetType: 'inquiry',
          toValue: nextHandlingStatus,
        })
      }
      await createAuditEvent(req, current, actor, 'message-sent', nextSequence, {
        targetId: String(message.id),
        targetType: 'message',
      })
      await writeReadPosition(req, current, actor, {
        forcedUnread: false,
        lastReadActivityId: activityId('message', message.id),
        lastReadSequence: actor.kind === 'patient' ? nextExternalSequence : nextClinicNotificationSequence,
      })
      return current
    })
    const actor = await resolveCurrentActor(req)
    return { inquiry: await buildDetailForActor(req, updatedInquiry, actor), replayed: false }
  } catch (error: unknown) {
    if (!duplicateConstraint(error)) throw error
    const actor = await resolveCurrentActor(req)
    const replay = await readMessageReplay(req, actor, input)
    if (!replay) {
      throw await withActorSafeCurrent(
        req,
        input.inquiryId,
        actor,
        new InquiryCommunicationServiceError('conflict', 'The message could not be sent safely.'),
      )
    }
    const inquiry = await readAuthorizedInquiry(req, input.inquiryId, actor)
    return { inquiry: await buildDetailForActor(req, inquiry, actor), replayed: true }
  }
}

export const sendClinicInquiryMessage = (
  req: PayloadRequest,
  input: ExternalMessageInput,
  storage?: InquiryAttachmentStorageGateway,
): Promise<InquiryMutationResultDTO> => sendInquiryMessage(req, input, 'clinic', storage)

export const sendPatientInquiryMessage = (
  req: PayloadRequest,
  input: ExternalMessageInput,
  storage?: InquiryAttachmentStorageGateway,
): Promise<InquiryMutationResultDTO> => sendInquiryMessage(req, input, 'patient', storage)

export const addClinicInquiryNote = async (
  req: PayloadRequest,
  rawInput: InternalNoteInput,
): Promise<InquiryMutationResultDTO> => {
  const parsed = internalNoteInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryCommunicationServiceError('invalid-input', 'The note input is invalid.')
  const input = parsed.data
  const initialActor = await resolveCurrentActor(req)
  if (initialActor.kind !== 'clinic') {
    throw new InquiryCommunicationServiceError('access-denied', 'Clinic access is required.')
  }
  let initialReplay: StoredRecord | null
  try {
    initialReplay = await readNoteReplay(req, initialActor, input)
  } catch (error: unknown) {
    throw await withActorSafeCurrent(req, input.inquiryId, initialActor, error)
  }
  if (initialReplay) {
    const inquiry = await readAuthorizedInquiry(req, input.inquiryId, initialActor)
    return { inquiry: await buildClinicDetail(req, inquiry, initialActor), replayed: true }
  }

  try {
    const updatedInquiry = await runRetryableActorInquiryCommand(req, input.inquiryId, initialActor, async () => {
      const actor = await resolveCurrentActor(req)
      if (actor.kind !== 'clinic' || actor.key !== initialActor.key) {
        throw new InquiryCommunicationServiceError('access-denied', 'The clinic participant changed.')
      }
      const replay = await readNoteReplay(req, actor, input)
      if (replay) return readAuthorizedInquiry(req, input.inquiryId, actor)
      const inquiry = await readAuthorizedInquiry(req, input.inquiryId, actor)
      assertOperationalInquiry(inquiry)
      const clinicId = relationId(inquiry.clinic)
      if (clinicId === null) throw new InquiryCommunicationServiceError('invalid-state', 'The clinic is unavailable.')
      const now = new Date().toISOString()
      const nextSequence = numberValue(inquiry.activitySequence, 1) + 1
      const nextClinicNotificationSequence = numberValue(inquiry.clinicNotificationSequence, 1) + 1
      const note = asRecord(
        await req.payload.create({
          collection: 'inquiryInternalNotes' as never,
          data: {
            actorKey: actor.key,
            authorClinicStaff: actor.id,
            clinic: clinicId,
            clinicNotificationSequence: nextClinicNotificationSequence,
            idempotencyKey: input.idempotencyKey,
            inquiry: inquiry.id,
            requestHash: noteRequestHash(input),
            sequence: nextSequence,
            text: input.text,
          },
          depth: 0,
          overrideAccess: true,
          req,
        } as never),
      )
      const current = await updateInquiry(req, inquiry, {
        activitySequence: nextSequence,
        clinicNotificationSequence: nextClinicNotificationSequence,
        lastActivityAt: now,
      })
      await createAuditEvent(req, current, actor, 'internal-note-added', nextSequence, {
        targetId: String(note.id),
        targetType: 'note',
      })
      await writeReadPosition(req, current, actor, {
        forcedUnread: false,
        lastReadActivityId: activityId('note', note.id),
        lastReadSequence: nextClinicNotificationSequence,
      })
      return current
    })
    const actor = await resolveCurrentActor(req)
    if (actor.kind !== 'clinic')
      throw new InquiryCommunicationServiceError('access-denied', 'Clinic access is required.')
    return { inquiry: await buildClinicDetail(req, updatedInquiry, actor), replayed: false }
  } catch (error: unknown) {
    if (!duplicateConstraint(error)) throw error
    const actor = await resolveCurrentActor(req)
    if (actor.kind !== 'clinic')
      throw new InquiryCommunicationServiceError('access-denied', 'Clinic access is required.')
    const replay = await readNoteReplay(req, actor, input)
    if (!replay) {
      throw await withActorSafeCurrent(
        req,
        input.inquiryId,
        actor,
        new InquiryCommunicationServiceError('conflict', 'The note could not be added safely.'),
      )
    }
    const inquiry = await readAuthorizedInquiry(req, input.inquiryId, actor)
    return { inquiry: await buildClinicDetail(req, inquiry, actor), replayed: true }
  }
}

export const updateClinicInquiryState = async (
  req: PayloadRequest,
  rawInput: InquiryStateInput,
): Promise<InquiryMutationResultDTO> => {
  const parsed = inquiryStateInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryCommunicationServiceError('invalid-input', 'The state input is invalid.')
  const input = parsed.data
  const initialActor = await resolveCurrentActor(req)
  if (initialActor.kind !== 'clinic') {
    throw new InquiryCommunicationServiceError('access-denied', 'Clinic access is required.')
  }

  let updatedInquiry: StoredRecord
  try {
    updatedInquiry = await runRetryableActorInquiryCommand(req, input.inquiryId, initialActor, async () => {
      const actor = await resolveCurrentActor(req)
      if (actor.kind !== 'clinic' || actor.key !== initialActor.key) {
        throw new InquiryCommunicationServiceError('access-denied', 'The clinic participant changed.')
      }
      const inquiry = await readAuthorizedInquiry(req, input.inquiryId, actor)
      assertOperationalInquiry(inquiry)
      await assertExpectedRevision(req, inquiry, actor, input.expectedRevision)
      const previousHandlingStatus = text(inquiry.handlingStatus) || 'submitted'
      const previousLifecycle = text(inquiry.lifecycle) || 'open'
      let nextHandlingStatus = previousHandlingStatus
      let nextLifecycle = previousLifecycle
      let nextPreviousHandlingStatus = text(inquiry.previousHandlingStatus) || null
      let eventType: 'closed' | 'handling-status-changed' | 'marked-spam' | 'reopened' | 'spam-removed'
      let fromValue: string
      let toValue: string
      let reason: string | undefined

      switch (input.action) {
        case 'set-handling-status':
          if (
            !isAllowedClinicHandlingStatusTransition(
              previousHandlingStatus as 'contacted' | 'in_review' | 'spam' | 'submitted',
              input.handlingStatus,
            )
          ) {
            throw new InquiryCommunicationServiceError('invalid-state', 'The handling status cannot be changed.')
          }
          nextHandlingStatus = input.handlingStatus
          eventType = 'handling-status-changed'
          fromValue = previousHandlingStatus
          toValue = nextHandlingStatus
          break
        case 'close':
          if (previousLifecycle !== 'open' || previousHandlingStatus === 'spam') {
            throw new InquiryCommunicationServiceError('invalid-state', 'The inquiry cannot be closed.')
          }
          nextLifecycle = 'closed'
          eventType = 'closed'
          fromValue = previousLifecycle
          toValue = nextLifecycle
          reason = input.reason
          break
        case 'reopen':
          if (previousLifecycle !== 'closed' || previousHandlingStatus === 'spam') {
            throw new InquiryCommunicationServiceError('invalid-state', 'The inquiry cannot be reopened.')
          }
          nextLifecycle = 'open'
          eventType = 'reopened'
          fromValue = previousLifecycle
          toValue = nextLifecycle
          break
        case 'mark-spam':
          if (previousHandlingStatus === 'spam') {
            throw new InquiryCommunicationServiceError('invalid-state', 'The inquiry is already marked as spam.')
          }
          nextPreviousHandlingStatus = previousHandlingStatus
          nextHandlingStatus = 'spam'
          nextLifecycle = 'closed'
          eventType = 'marked-spam'
          fromValue = `${previousHandlingStatus}:${previousLifecycle}`
          toValue = 'spam:closed'
          reason = input.reason
          break
        case 'remove-spam':
          if (previousHandlingStatus !== 'spam') {
            throw new InquiryCommunicationServiceError('invalid-state', 'The inquiry is not marked as spam.')
          }
          nextHandlingStatus = nextPreviousHandlingStatus || 'submitted'
          nextPreviousHandlingStatus = null
          nextLifecycle = 'closed'
          eventType = 'spam-removed'
          fromValue = 'spam:closed'
          toValue = `${nextHandlingStatus}:closed`
          break
      }

      const nextSequence = numberValue(inquiry.activitySequence, 1) + 1
      const current = await updateInquiry(req, inquiry, {
        activitySequence: nextSequence,
        ...(eventType === 'marked-spam'
          ? {
              clinicUnreadEpoch: numberValue(inquiry.clinicUnreadEpoch) + 1,
              clinicUnreadFloor: numberValue(inquiry.clinicNotificationSequence, 1),
            }
          : {}),
        handlingStatus: nextHandlingStatus,
        lastActivityAt: new Date().toISOString(),
        lifecycle: nextLifecycle,
        previousHandlingStatus: nextPreviousHandlingStatus,
        revision: numberValue(inquiry.revision) + 1,
      })
      await createAuditEvent(req, current, actor, eventType, nextSequence, {
        fromValue,
        ...(reason ? { reason } : {}),
        targetId: String(current.id),
        targetType: 'inquiry',
        toValue,
      })
      return current
    })
  } catch (error: unknown) {
    throw await withActorSafeCurrent(req, input.inquiryId, initialActor, error)
  }

  const actor = await resolveCurrentActor(req)
  if (actor.kind !== 'clinic') throw new InquiryCommunicationServiceError('access-denied', 'Clinic access is required.')
  return { inquiry: await buildClinicDetail(req, updatedInquiry, actor), replayed: false }
}

const parsedActivityId = (value: string): { id: RelationId; kind: 'event' | 'message' | 'note' } | null => {
  const match = /^(event|message|note):(.+)$/u.exec(value)
  if (!match?.[1] || !match[2]) return null
  return { id: payloadId(match[2]), kind: match[1] as 'event' | 'message' | 'note' }
}

const visibleActivitySequence = async (
  req: PayloadRequest,
  inquiry: StoredRecord,
  actor: InquiryActor,
  value: string,
): Promise<number> => {
  const parsed = parsedActivityId(value)
  if (!parsed || (actor.kind === 'patient' && parsed.kind !== 'message')) {
    throw new InquiryCommunicationServiceError('invalid-input', 'The read activity is not visible.')
  }
  const collection =
    parsed.kind === 'message'
      ? 'inquiryMessages'
      : parsed.kind === 'note'
        ? 'inquiryInternalNotes'
        : 'inquiryAuditEvents'
  const record = await findOne(req, collection, {
    and: [{ id: { equals: parsed.id } }, { inquiry: { equals: inquiry.id } }],
  })
  if (!record) throw new InquiryCommunicationServiceError('invalid-input', 'The read activity is not visible.')
  if (
    parsed.kind === 'event' &&
    !['handling-status-changed', 'closed', 'reopened', 'marked-spam', 'spam-removed'].includes(text(record.eventType))
  ) {
    throw new InquiryCommunicationServiceError('invalid-input', 'The read activity is not visible.')
  }
  const sequence = numberValue(
    actor.kind === 'patient' ? record.externalSequence : record.clinicNotificationSequence,
    -1,
  )
  const maximum = numberValue(actor.kind === 'patient' ? inquiry.externalSequence : inquiry.clinicNotificationSequence)
  if (sequence < 0 || sequence > maximum) {
    throw new InquiryCommunicationServiceError('invalid-input', 'The read activity is not visible.')
  }
  return sequence
}

const updateInquiryReadPosition = async (
  req: PayloadRequest,
  rawInput: InquiryReadPositionInput,
  requiredActor: InquiryActor['kind'],
): Promise<InquiryMutationResultDTO> => {
  const parsed = inquiryReadPositionInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryCommunicationServiceError('invalid-input', 'The read input is invalid.')
  const input = parsed.data
  const initialActor = await resolveCurrentActor(req)
  if (initialActor.kind !== requiredActor) {
    throw new InquiryCommunicationServiceError('access-denied', `A ${requiredActor} participant is required.`)
  }
  if (input.mode === 'unread' && (requiredActor !== 'clinic' || input.activityId)) {
    throw new InquiryCommunicationServiceError('invalid-input', 'This inquiry cannot be marked unread.')
  }
  if (input.mode === 'read' && requiredActor === 'patient' && !input.activityId) {
    throw new InquiryCommunicationServiceError(
      'invalid-input',
      'Patients can only mark a visibly loaded external activity as read.',
    )
  }

  const inquiry = await runRetryableActorInquiryCommand(req, input.inquiryId, initialActor, async () => {
    const actor = await resolveCurrentActor(req)
    if (actor.kind !== requiredActor || actor.key !== initialActor.key) {
      throw new InquiryCommunicationServiceError('access-denied', 'The inquiry participant changed.')
    }
    const current = await readAuthorizedInquiry(req, input.inquiryId, actor)
    assertOperationalInquiry(current)
    const existing = await readPosition(req, current, actor)
    if (input.mode === 'unread') {
      await writeReadPosition(req, current, actor, {
        forcedUnread: true,
        lastReadActivityId: text(existing?.lastReadActivityId) || null,
        lastReadSequence: numberValue(existing?.lastReadSequence),
      })
      return current
    }

    const maximum = numberValue(
      actor.kind === 'patient' ? current.externalSequence : current.clinicNotificationSequence,
    )
    const target = input.activityId ? await visibleActivitySequence(req, current, actor, input.activityId) : maximum
    const existingSequence = numberValue(existing?.lastReadSequence)
    await writeReadPosition(req, current, actor, {
      forcedUnread: false,
      lastReadActivityId:
        target < existingSequence
          ? text(existing?.lastReadActivityId) || null
          : (input.activityId ?? (target === existingSequence ? text(existing?.lastReadActivityId) || null : null)),
      lastReadSequence: Math.max(existingSequence, target),
    })
    return current
  })
  const actor = await resolveCurrentActor(req)
  return { inquiry: await buildDetailForActor(req, inquiry, actor), replayed: false }
}

export const updateClinicInquiryReadPosition = (
  req: PayloadRequest,
  input: InquiryReadPositionInput,
): Promise<InquiryMutationResultDTO> => updateInquiryReadPosition(req, input, 'clinic')

export const updatePatientInquiryReadPosition = (
  req: PayloadRequest,
  input: InquiryReadPositionInput,
): Promise<InquiryMutationResultDTO> => updateInquiryReadPosition(req, input, 'patient')

const assertAttachmentOwner = (attachment: StoredRecord, actor: InquiryActor): void => {
  if (text(attachment.actorKey) !== actor.key || text(attachment.ownerKind) !== actor.kind) {
    throw new InquiryCommunicationServiceError('not-found', 'The attachment does not exist.')
  }
}

const attachmentRecordDTO = (attachment: StoredRecord) => {
  const result = attachmentDTO(attachment)
  if (!result) throw new InquiryCommunicationServiceError('invalid-state', 'The attachment is not verified.')
  return result
}

const attachmentObjectPrefix = (inquiry: StoredRecord, actor: InquiryActor): string =>
  `inquiry-communication/${String(relationId(inquiry.clinic))}/${String(inquiry.id)}/${requestHash(actor.key).slice(0, 24)}`

export const INQUIRY_ATTACHMENT_DRAFT_LIMITS = {
  activePerActor: 10,
  activePerClinic: 100,
  reservationWindowMs: 15 * 60 * 1_000,
  reservationsPerActor: 20,
  reservationsPerClinic: 200,
} as const

const countAttachments = async (req: PayloadRequest, where: Record<string, unknown>): Promise<number> => {
  const result = await req.payload.count({
    collection: 'inquiryAttachments' as never,
    overrideAccess: true,
    req,
    where,
  } as never)
  return result.totalDocs
}

const assertAttachmentDraftCapacity = async (
  req: PayloadRequest,
  actor: InquiryActor,
  clinicId: RelationId,
  nowMs: number,
): Promise<void> => {
  const activeStates = { state: { in: ['draft', 'verified'] } }
  const activeForActor = await countAttachments(req, {
    and: [{ actorKey: { equals: actor.key } }, activeStates],
  })
  if (activeForActor >= INQUIRY_ATTACHMENT_DRAFT_LIMITS.activePerActor) {
    throw new InquiryCommunicationServiceError('rate-limited', 'Too many active attachment drafts.')
  }
  const activeForClinic = await countAttachments(req, {
    and: [{ clinic: { equals: clinicId } }, activeStates],
  })
  if (activeForClinic >= INQUIRY_ATTACHMENT_DRAFT_LIMITS.activePerClinic) {
    throw new InquiryCommunicationServiceError('rate-limited', 'Too many active attachment drafts.')
  }

  const windowStart = new Date(nowMs - INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationWindowMs).toISOString()
  const recentForActor = await countAttachments(req, {
    and: [{ actorKey: { equals: actor.key } }, { objectCreatedAt: { greater_than_equal: windowStart } }],
  })
  if (recentForActor >= INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationsPerActor) {
    throw new InquiryCommunicationServiceError('rate-limited', 'Attachment draft rate limit reached.')
  }
  const recentForClinic = await countAttachments(req, {
    and: [{ clinic: { equals: clinicId } }, { objectCreatedAt: { greater_than_equal: windowStart } }],
  })
  if (recentForClinic >= INQUIRY_ATTACHMENT_DRAFT_LIMITS.reservationsPerClinic) {
    throw new InquiryCommunicationServiceError('rate-limited', 'Attachment draft rate limit reached.')
  }
}

export const createAttachmentDraft = async (
  req: PayloadRequest,
  rawInput: AttachmentDraftCreateInput,
  storage: InquiryAttachmentStorageGateway = createS3InquiryAttachmentStorage(),
): Promise<AttachmentDraftDTO> => {
  const parsed = attachmentDraftCreateInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryCommunicationServiceError('invalid-input', 'The attachment input is invalid.')
  const input = parsed.data
  const initialActor = await resolveCurrentActor(req)
  const initialInquiry = await readAuthorizedInquiry(req, input.inquiryId, initialActor)
  await assertExternalCommunicationOpen(req, initialInquiry, initialActor)
  const token = randomUUID()
  const draftObjectKey = `${attachmentObjectPrefix(initialInquiry, initialActor)}/draft/${token}`
  const nowMs = Date.now()
  const expiresAt = new Date(nowMs + 15 * 60 * 1_000).toISOString()

  let attachment: StoredRecord
  try {
    attachment = await runRetryableActorInquiryCommand(req, input.inquiryId, initialActor, async () => {
      const actor = await resolveCurrentActor(req)
      if (actor.key !== initialActor.key || actor.kind !== initialActor.kind) {
        throw new InquiryCommunicationServiceError('access-denied', 'The inquiry participant changed.')
      }
      const inquiry = await readAuthorizedInquiry(req, input.inquiryId, actor)
      await assertExternalCommunicationOpen(req, inquiry, actor)
      const clinicId = relationId(inquiry.clinic)
      const ownerId = relationId(inquiry.patient)
      if (clinicId === null || ownerId === null) {
        throw new InquiryCommunicationServiceError('invalid-state', 'The inquiry participants are unavailable.')
      }
      await assertAttachmentDraftCapacity(req, actor, clinicId, nowMs)
      const created = asRecord(
        await req.payload.create({
          collection: 'inquiryAttachments' as never,
          data: {
            actorKey: actor.key,
            clinic: clinicId,
            declaredMimeType: input.mimeType,
            declaredSizeBytes: input.sizeBytes,
            draftObjectKey,
            expiresAt,
            fileName: input.fileName,
            inquiry: inquiry.id,
            ownerClinicStaff: actor.kind === 'clinic' ? actor.id : null,
            ownerKind: actor.kind,
            ownerPatient: actor.kind === 'patient' ? actor.id : null,
            objectCreatedAt: new Date(nowMs).toISOString(),
            patient: ownerId,
            state: 'draft',
          },
          depth: 0,
          overrideAccess: true,
          req,
        } as never),
      )
      await createAuditEvent(
        req,
        inquiry,
        actor,
        'attachment-draft-created',
        numberValue(inquiry.activitySequence, 1),
        {
          targetId: String(created.id),
          targetType: 'attachment',
        },
      )
      return created
    })
  } catch (error: unknown) {
    if (
      error instanceof InquiryCommunicationServiceError &&
      error.kind === 'conflict' &&
      error.message === 'The inquiry changed concurrently.'
    ) {
      throw new InquiryCommunicationServiceError('rate-limited', 'Attachment draft capacity is temporarily busy.')
    }
    throw error
  }

  let upload: AttachmentDraftDTO['upload']
  try {
    upload = await storage.createUpload({
      draftObjectKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    })
    if (Object.keys(upload.headers).some((key) => key.toLowerCase() === 'content-length')) {
      throw new InquiryCommunicationServiceError(
        'unavailable',
        'Attachment storage returned a forbidden browser header.',
      )
    }
  } catch (error: unknown) {
    try {
      await discardAttachmentDraft(req, { draftId: String(attachment.id), inquiryId: input.inquiryId })
      await cleanupDiscardedAttachment(req, { attachmentId: String(attachment.id) }, storage)
    } catch {
      req.payload.logger.error(
        { attachmentId: String(attachment.id), event: 'inquiry_attachment_reservation_cleanup_failed' },
        'Failed attachment upload reservation could not be released',
      )
    }
    throw error instanceof InquiryCommunicationServiceError ? error : mapStorageError(error)
  }

  return { draftId: String(attachment.id), expiresAt, upload }
}

const readOwnedAttachment = async (
  req: PayloadRequest,
  input: AttachmentDraftMutationInput,
  actor: InquiryActor,
): Promise<{ attachment: StoredRecord; inquiry: StoredRecord }> => {
  const inquiry = await readAuthorizedInquiry(req, input.inquiryId, actor)
  const attachment = await findOne(req, 'inquiryAttachments', {
    and: [{ id: { equals: payloadId(input.draftId) } }, { inquiry: { equals: inquiry.id } }],
  })
  if (!attachment) throw new InquiryCommunicationServiceError('not-found', 'The attachment does not exist.')
  assertAttachmentOwner(attachment, actor)
  return { attachment, inquiry }
}

export const cleanupFinalizedAttachmentDraft = async (
  req: PayloadRequest,
  input: { attachmentId: string },
  storage: InquiryAttachmentStorageGateway = createS3InquiryAttachmentStorage(),
): Promise<boolean> => {
  const attachment = await findOne(req, 'inquiryAttachments', {
    and: [
      { id: { equals: payloadId(input.attachmentId) } },
      { state: { in: ['verified', 'bound'] } },
      { draftCleanupCompletedAt: { exists: false } },
    ],
  })
  if (!attachment) return true
  const draftObjectKey = text(attachment.draftObjectKey)
  if (!draftObjectKey) return false

  try {
    await storage.deleteObjects([draftObjectKey])
    await runCommandTransaction(req, async () => {
      const current = await findOne(req, 'inquiryAttachments', { id: { equals: attachment.id } })
      if (!current || current.draftCleanupCompletedAt) return
      if (current.state !== 'verified' && current.state !== 'bound') return
      await req.payload.update({
        collection: 'inquiryAttachments' as never,
        data: { draftCleanupCompletedAt: new Date().toISOString() },
        depth: 0,
        id: current.id,
        overrideAccess: true,
        req,
      } as never)
    })
    return true
  } catch {
    req.payload.logger.error(
      { attachmentId: String(attachment.id), event: 'inquiry_attachment.draft_cleanup_failed' },
      'Finalized inquiry attachment draft cleanup failed',
    )
    return false
  }
}

export const finalizeAttachmentDraft = async (
  req: PayloadRequest,
  rawInput: AttachmentDraftMutationInput,
  storage: InquiryAttachmentStorageGateway = createS3InquiryAttachmentStorage(),
): Promise<AttachmentFinalizeDTO> => {
  const parsed = attachmentDraftMutationInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryCommunicationServiceError('invalid-input', 'The attachment input is invalid.')
  const input = parsed.data
  const initialActor = await resolveCurrentActor(req)
  const reserved = await runActorInquiryCommand(req, input.inquiryId, initialActor, async () => {
    const actor = await resolveCurrentActor(req)
    if (actor.key !== initialActor.key || actor.kind !== initialActor.kind) {
      throw new InquiryCommunicationServiceError('access-denied', 'The inquiry participant changed.')
    }
    const current = await readOwnedAttachment(req, input, actor)
    await assertExternalCommunicationOpen(req, current.inquiry, actor)
    if (current.attachment.state === 'verified' || current.attachment.state === 'bound') {
      return { attachment: current.attachment, readyObjectKey: text(current.attachment.readyObjectKey) }
    }
    const expiresAtMs = Date.parse(text(current.attachment.expiresAt))
    if (current.attachment.state !== 'draft' || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      throw new InquiryCommunicationServiceError('invalid-state', 'The attachment draft is not available.')
    }
    const existingReadyObjectKey = text(current.attachment.readyObjectKey)
    if (existingReadyObjectKey) {
      return { attachment: current.attachment, readyObjectKey: existingReadyObjectKey }
    }
    const readyObjectKey = `${attachmentObjectPrefix(current.inquiry, actor)}/ready/${randomUUID()}`
    const attachment = asRecord(
      await req.payload.update({
        collection: 'inquiryAttachments' as never,
        data: { readyObjectKey },
        depth: 0,
        id: current.attachment.id,
        overrideAccess: true,
        req,
      } as never),
    )
    return { attachment, readyObjectKey }
  })
  if (reserved.attachment.state === 'verified' || reserved.attachment.state === 'bound') {
    await cleanupFinalizedAttachmentDraft(req, { attachmentId: String(reserved.attachment.id) }, storage)
    return { attachment: attachmentRecordDTO(reserved.attachment) }
  }

  let sealed
  try {
    sealed = await storage.sealDraft({
      declaredMimeType: text(reserved.attachment.declaredMimeType) as InquiryAttachmentMimeType,
      declaredSizeBytes: numberValue(reserved.attachment.declaredSizeBytes),
      draftObjectKey: text(reserved.attachment.draftObjectKey),
      readyObjectKey: reserved.readyObjectKey,
    })
  } catch (error: unknown) {
    const replay = await readOwnedAttachment(req, input, initialActor).catch(() => null)
    if (replay?.attachment.state === 'verified' || replay?.attachment.state === 'bound') {
      await cleanupFinalizedAttachmentDraft(req, { attachmentId: String(replay.attachment.id) }, storage)
      return { attachment: attachmentRecordDTO(replay.attachment) }
    }
    throw mapStorageError(error)
  }

  try {
    const attachment = await runActorInquiryCommand(req, input.inquiryId, initialActor, async () => {
      const actor = await resolveCurrentActor(req)
      if (actor.key !== initialActor.key || actor.kind !== initialActor.kind) {
        throw new InquiryCommunicationServiceError('access-denied', 'The inquiry participant changed.')
      }
      const current = await readOwnedAttachment(req, input, actor)
      await assertExternalCommunicationOpen(req, current.inquiry, actor)
      if (current.attachment.state === 'verified' || current.attachment.state === 'bound') {
        if (text(current.attachment.readyObjectKey) !== sealed.readyObjectKey) {
          throw new InquiryCommunicationServiceError('invalid-state', 'The sealed attachment identity changed.')
        }
        return current.attachment
      }
      if (current.attachment.state !== 'draft') {
        throw new InquiryCommunicationServiceError('invalid-state', 'The attachment draft is not available.')
      }
      if (text(current.attachment.readyObjectKey) !== sealed.readyObjectKey) {
        throw new InquiryCommunicationServiceError('invalid-state', 'The sealed attachment identity changed.')
      }
      const verified = asRecord(
        await req.payload.update({
          collection: 'inquiryAttachments' as never,
          data: {
            state: 'verified',
            verifiedMimeType: sealed.mimeType,
            verifiedSizeBytes: sealed.sizeBytes,
          },
          depth: 0,
          id: current.attachment.id,
          overrideAccess: true,
          req,
        } as never),
      )
      await createAuditEvent(
        req,
        current.inquiry,
        actor,
        'attachment-finalized',
        numberValue(current.inquiry.activitySequence, 1),
        { targetId: String(verified.id), targetType: 'attachment' },
      )
      return verified
    })
    await cleanupFinalizedAttachmentDraft(req, { attachmentId: String(attachment.id) }, storage)
    return { attachment: attachmentRecordDTO(attachment) }
  } catch (error: unknown) {
    const recovery = await readOwnedAttachment(req, input, initialActor).catch(() => null)
    if (
      recovery &&
      (recovery.attachment.state === 'verified' || recovery.attachment.state === 'bound') &&
      text(recovery.attachment.readyObjectKey) === sealed.readyObjectKey
    ) {
      await cleanupFinalizedAttachmentDraft(req, { attachmentId: String(recovery.attachment.id) }, storage)
      return { attachment: attachmentRecordDTO(recovery.attachment) }
    }
    try {
      await storage.deleteObjects([sealed.readyObjectKey])
    } catch {
      req.payload.logger.error(
        { attachmentId: String(reserved.attachment.id), event: 'inquiry_attachment.ready_cleanup_failed' },
        'Uncommitted inquiry attachment ready cleanup failed',
      )
    }
    throw error
  }
}

export type AttachmentDiscardResult = { attachmentId: string; discarded: true }

export const discardAttachmentDraft = async (
  req: PayloadRequest,
  rawInput: AttachmentDraftMutationInput,
): Promise<AttachmentDiscardResult> => {
  const parsed = attachmentDraftMutationInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryCommunicationServiceError('invalid-input', 'The attachment input is invalid.')
  const input = parsed.data
  const initialActor = await resolveCurrentActor(req)
  const attachment = await runActorInquiryCommand(req, input.inquiryId, initialActor, async () => {
    const actor = await resolveCurrentActor(req)
    if (actor.key !== initialActor.key || actor.kind !== initialActor.kind) {
      throw new InquiryCommunicationServiceError('access-denied', 'The inquiry participant changed.')
    }
    const current = await readOwnedAttachment(req, input, actor)
    assertOperationalInquiry(current.inquiry)
    if (current.attachment.state === 'discarded') return current.attachment
    if (current.attachment.state === 'bound') {
      throw new InquiryCommunicationServiceError('invalid-state', 'A message attachment cannot be discarded.')
    }
    const discarded = asRecord(
      await req.payload.update({
        collection: 'inquiryAttachments' as never,
        data: { state: 'discarded' },
        depth: 0,
        id: current.attachment.id,
        overrideAccess: true,
        req,
      } as never),
    )
    await createAuditEvent(
      req,
      current.inquiry,
      actor,
      'attachment-discarded',
      numberValue(current.inquiry.activitySequence, 1),
      { targetId: String(discarded.id), targetType: 'attachment' },
    )
    return discarded
  })
  return { attachmentId: String(attachment.id), discarded: true }
}

export const cleanupDiscardedAttachment = async (
  req: PayloadRequest,
  input: { attachmentId: string },
  storage: InquiryAttachmentStorageGateway = createS3InquiryAttachmentStorage(),
): Promise<boolean> => {
  const attachment = await findOne(req, 'inquiryAttachments', {
    and: [
      { id: { equals: payloadId(input.attachmentId) } },
      { state: { equals: 'discarded' } },
      { cleanupCompletedAt: { exists: false } },
    ],
  })
  if (!attachment) return true
  const keys = [text(attachment.draftObjectKey), text(attachment.readyObjectKey)].filter(Boolean)
  try {
    await storage.deleteObjects(keys)
    const cleanedAt = new Date().toISOString()
    await req.payload.update({
      collection: 'inquiryAttachments' as never,
      data: { cleanupCompletedAt: cleanedAt, draftCleanupCompletedAt: cleanedAt },
      depth: 0,
      id: attachment.id,
      overrideAccess: true,
      req,
    } as never)
    return true
  } catch {
    req.payload.logger.error(
      { attachmentId: String(attachment.id), event: 'inquiry_attachment.cleanup_failed' },
      'Inquiry attachment cleanup failed',
    )
    return false
  }
}

export const sweepExpiredAttachmentDrafts = async (
  req: PayloadRequest,
  storage: InquiryAttachmentStorageGateway = createS3InquiryAttachmentStorage(),
): Promise<{ cleaned: number; examined: number }> => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString()
  const candidates = await findMany(
    req,
    'inquiryAttachments',
    {
      and: [
        { objectCreatedAt: { less_than: cutoff } },
        {
          or: [
            {
              and: [{ state: { in: ['draft', 'verified', 'discarded'] } }, { cleanupCompletedAt: { exists: false } }],
            },
            {
              and: [{ state: { equals: 'bound' } }, { draftCleanupCompletedAt: { exists: false } }],
            },
          ],
        },
      ],
    },
    { limit: 50, sort: 'createdAt' },
  )
  let cleaned = 0
  for (const candidate of candidates) {
    if (candidate.state === 'bound') {
      if (await cleanupFinalizedAttachmentDraft(req, { attachmentId: String(candidate.id) }, storage)) cleaned += 1
      continue
    }
    let attachment = candidate
    if (candidate.state === 'draft' || candidate.state === 'verified') {
      const claimed = await runCommandTransaction(req, async () => {
        const current = await findOne(req, 'inquiryAttachments', { id: { equals: candidate.id } })
        if (!current || (current.state !== 'draft' && current.state !== 'verified')) return null
        const inquiryId = relationId(current.inquiry)
        if (inquiryId === null) return null
        const inquiry = await findOne(req, 'patientClinicInquiries', { id: { equals: inquiryId } })
        if (!inquiry || !isOperationalInquiry(inquiry)) return null
        const discarded = asRecord(
          await req.payload.update({
            collection: 'inquiryAttachments' as never,
            data: { state: 'discarded' },
            depth: 0,
            id: current.id,
            overrideAccess: true,
            req,
          } as never),
        )
        await createAuditEvent(
          req,
          inquiry,
          { id: 'system', kind: 'system' },
          'attachment-discarded',
          numberValue(inquiry.activitySequence, 1),
          { reason: 'expired-unbound-attachment', targetId: String(discarded.id), targetType: 'attachment' },
        )
        return discarded
      })
      if (!claimed) continue
      attachment = claimed
    }
    if (await cleanupDiscardedAttachment(req, { attachmentId: String(attachment.id) }, storage)) cleaned += 1
  }
  return { cleaned, examined: candidates.length }
}

export const readAttachmentAccess = async (
  req: PayloadRequest,
  input: { attachmentId: string; mode: 'download' | 'preview' },
  storage: InquiryAttachmentStorageGateway = createS3InquiryAttachmentStorage(),
) => {
  const actor = await resolveCurrentActor(req)
  const attachment = await findOne(req, 'inquiryAttachments', {
    and: [{ id: { equals: payloadId(input.attachmentId) } }, { state: { equals: 'bound' } }],
  })
  if (!attachment) throw new InquiryCommunicationServiceError('not-found', 'The attachment does not exist.')
  const inquiryId = relationId(attachment.inquiry)
  if (inquiryId === null) throw new InquiryCommunicationServiceError('not-found', 'The attachment does not exist.')
  await readAuthorizedInquiry(req, String(inquiryId), actor)
  const sealed = sealedAttachmentArgs(attachment)
  try {
    await storage.verifySealed(sealed)
    return await storage.createReadAccess({
      disposition: input.mode === 'preview' ? 'inline' : 'attachment',
      fileName: text(attachment.fileName),
      mimeType: sealed.expectedMimeType,
      readyObjectKey: sealed.readyObjectKey,
    })
  } catch (error: unknown) {
    throw mapStorageError(error)
  }
}

export const revealClinicInquiryContact = async (
  req: PayloadRequest,
  input: { inquiryId: string },
): Promise<InquiryContactRevealDTO> => {
  if (req.context?.inquiryContactReauthorized !== true) {
    throw new InquiryCommunicationServiceError(
      'reauthentication-required',
      'Recent reauthentication is required to reveal spam contact details.',
    )
  }
  const actor = await resolveCurrentActor(req)
  if (actor.kind !== 'clinic') throw new InquiryCommunicationServiceError('access-denied', 'Clinic access is required.')
  const inquiry = await readAuthorizedInquiry(req, input.inquiryId, actor)
  if (!isOperationalInquiry(inquiry)) {
    throw new InquiryCommunicationServiceError(
      'invalid-state',
      'This legacy inquiry is awaiting the communication cutover.',
      await buildClinicDetail(req, inquiry, actor),
    )
  }
  if (text(inquiry.handlingStatus) !== 'spam') {
    throw new InquiryCommunicationServiceError('invalid-state', 'Contact reveal is only available for spam inquiries.')
  }
  await runActorInquiryCommand(req, input.inquiryId, actor, async () => {
    const currentActor = await resolveCurrentActor(req)
    if (currentActor.kind !== 'clinic' || currentActor.key !== actor.key) {
      throw new InquiryCommunicationServiceError('access-denied', 'The clinic participant changed.')
    }
    const current = await readAuthorizedInquiry(req, input.inquiryId, currentActor)
    assertOperationalInquiry(current)
    if (text(current.handlingStatus) !== 'spam') {
      throw new InquiryCommunicationServiceError(
        'invalid-state',
        'Contact reveal is only available for spam inquiries.',
      )
    }
    await createAuditEvent(req, current, currentActor, 'contact-revealed', numberValue(current.activitySequence, 1), {
      targetId: String(current.id),
      targetType: 'inquiry-contact',
    })
  })
  return {
    contact: { email: text(inquiry.email), mode: 'full', phoneNumber: text(inquiry.phoneNumber) },
    inquiryId: String(inquiry.id),
  }
}

export const readPatientInquiryDetail = async (
  req: PayloadRequest,
  input: { inquiryId: string },
): Promise<InquiryDetailDTO> => {
  const ownerId = patientId(req)
  const inquiry = await findOne(req, 'patientClinicInquiries', {
    and: [{ id: { equals: payloadId(input.inquiryId) } }, { patient: { equals: ownerId } }],
  })
  if (!inquiry) throw new InquiryCommunicationServiceError('not-found', 'The inquiry does not exist.')
  return buildPatientDetail(req, inquiry)
}

export const readPatientInquiryDetailResult = async (
  req: PayloadRequest,
  rawInput: InquiryDetailInput,
): Promise<InquiryDetailResultDTO> => {
  const parsed = inquiryDetailInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryCommunicationServiceError('invalid-input', 'The detail input is invalid.')
  const input = parsed.data
  const inquiry = await readPatientInquiryDetail(req, { inquiryId: input.inquiryId })
  const changeCursor = detailChangeCursor(inquiry)
  return {
    changeCursor,
    inquiry,
    unchanged: input.knownChangeCursor === changeCursor,
  }
}

export const createVerifiedPatientInquiry = async (
  req: PayloadRequest,
  rawInput: VerifiedInquiryCreateInput,
): Promise<InquiryMutationResultDTO & { replayed: boolean }> => {
  const parsed = verifiedInquiryCreateInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryCommunicationServiceError('invalid-input', 'The inquiry input is invalid.')
  const input = parsed.data
  const ownerId = patientId(req)
  const ownerActorKey = actorKey(req)

  const existing = await findCreationReplay(req, ownerId, input)
  if (existing) return { inquiry: await buildPatientDetail(req, existing), replayed: true }

  const now = new Date().toISOString()

  try {
    const inquiry = await runCommandTransaction(req, async () => {
      const replay = await findCreationReplay(req, ownerId, input)
      if (replay) return replay
      await validateInquiryTarget(req, input)

      const patient = await readPatient(req, ownerId)
      const firstName = text(patient.firstName).trim()
      const lastName = text(patient.lastName).trim()
      const email = text(patient.email).trim().toLowerCase()
      if (!firstName || !lastName || !email) {
        throw new InquiryCommunicationServiceError('invalid-state', 'The patient account identity is incomplete.')
      }

      let phoneNumber = text(patient.phoneNumber).trim()
      if (!phoneNumber) {
        if (!input.phoneNumber) {
          throw new InquiryCommunicationServiceError('invalid-input', 'A patient account phone number is required.')
        }
        const updatedPatient = asRecord(
          await req.payload.update({
            collection: 'patients',
            data: { phoneNumber: input.phoneNumber },
            depth: 0,
            id: ownerId,
            overrideAccess: true,
            req,
          } as never),
        )
        phoneNumber = text(updatedPatient.phoneNumber).trim()
      }

      const created = asRecord(
        await req.payload.create({
          collection: 'patientClinicInquiries',
          context: { inquiryCommunicationCommand: true },
          data: {
            activitySequence: 1,
            clinic: payloadId(input.clinicId),
            clinicNotificationSequence: 1,
            clinicUnreadEpoch: 0,
            clinicUnreadFloor: 0,
            consent: {
              accepted: true,
              acceptedAt: now,
              text: 'Consent captured for a verified synthetic inquiry.',
            },
            creationActorKey: ownerActorKey,
            creationIdempotencyKey: input.idempotencyKey,
            creationRequestHash: requestHash(input),
            doctor: input.doctorId ? payloadId(input.doctorId) : null,
            email,
            externalSequence: 0,
            fullName: `${firstName} ${lastName}`,
            handlingStatus: 'submitted',
            lastActivityAt: now,
            lifecycle: 'open',
            message: input.message,
            patient: ownerId,
            phoneNumber,
            preferredContactWindow: input.preferredContactWindow ?? null,
            revision: 0,
            status: 'submitted',
            treatment: input.treatmentId ? payloadId(input.treatmentId) : null,
            treatmentTimeline: input.treatmentTimeline ?? null,
          },
          depth: 0,
          overrideAccess: true,
          req,
        } as never),
      )

      await req.payload.create({
        collection: 'inquiryConversations' as never,
        data: {
          actorKey: ownerActorKey,
          clinic: payloadId(input.clinicId),
          inquiry: created.id,
          patient: ownerId,
        },
        depth: 0,
        overrideAccess: true,
        req,
      } as never)
      await req.payload.create({
        collection: 'inquiryReadPositions' as never,
        data: {
          clinic: payloadId(input.clinicId),
          forcedUnread: false,
          forcedUnreadEpoch: 0,
          inquiry: created.id,
          lastReadSequence: 0,
          readerKey: ownerActorKey,
          readerKind: 'patient',
          readerPatient: ownerId,
        },
        depth: 0,
        overrideAccess: true,
        req,
      } as never)
      await req.payload.create({
        collection: 'inquiryAuditEvents' as never,
        data: {
          actorId: String(ownerId),
          actorKind: 'patient',
          clinic: payloadId(input.clinicId),
          clinicNotificationSequence: 1,
          eventType: 'inquiry-created',
          inquiry: created.id,
          sequence: 1,
          targetId: String(created.id),
          targetType: 'inquiry',
        },
        depth: 0,
        overrideAccess: true,
        req,
      } as never)
      return created
    })

    return { inquiry: await buildPatientDetail(req, inquiry), replayed: false }
  } catch (error: unknown) {
    if (!duplicateConstraint(error)) throw error
    const replay = await findCreationReplay(req, ownerId, input)
    if (!replay) throw new InquiryCommunicationServiceError('conflict', 'The inquiry could not be created safely.')
    return { inquiry: await buildPatientDetail(req, replay), replayed: true }
  }
}

const GUEST_INQUIRY_DUPLICATE_WINDOW_MS = 15 * 60 * 1_000
const GUEST_INQUIRY_CONSENT_TEXT =
  'By submitting this request, you agree that findmydoc may process your contact details to coordinate follow-up about this clinic inquiry.'

const guestInquiryRequestHash = (input: GuestInquiryCreateInput): string =>
  requestHash({
    clinicId: input.clinicId,
    doctorId: input.doctorId ?? null,
    email: input.email,
    fullName: input.fullName,
    message: input.message,
    phoneNumber: input.phoneNumber,
    preferredContactWindow: input.preferredContactWindow ?? null,
    treatmentId: input.treatmentId ?? null,
    treatmentTimeline: input.treatmentTimeline ?? null,
  })

const findGuestInquiryReplay = async (
  req: PayloadRequest,
  guestActorKey: string,
  hash: string,
  nowMs: number,
): Promise<StoredRecord | null> => {
  const [candidate] = await findMany(
    req,
    'patientClinicInquiries',
    {
      and: [
        { creationActorKey: { equals: guestActorKey } },
        { creationRequestHash: { equals: hash } },
        { patient: { exists: false } },
      ],
    },
    { limit: 1, sort: '-createdAt' },
  )
  if (!candidate) return null
  const createdAt = Date.parse(text(candidate.createdAt))
  return Number.isFinite(createdAt) && nowMs - createdAt <= GUEST_INQUIRY_DUPLICATE_WINDOW_MS ? candidate : null
}

const runRetryableCommand = async <Result>(req: PayloadRequest, command: () => Promise<Result>): Promise<Result> => {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await runCommandTransaction(req, command)
    } catch (error: unknown) {
      lastError = error
      if (
        !(
          error instanceof InquiryCommunicationServiceError &&
          error.kind === 'conflict' &&
          error.message === 'The inquiry changed concurrently.'
        ) ||
        attempt === 2
      ) {
        throw error
      }
    }
  }
  throw lastError
}

export type GuestInquirySubmissionResult = {
  deduped: boolean
  id: string
  status: 'submitted'
}

export const submitGuestClinicInquiry = async (
  req: PayloadRequest,
  rawInput: GuestInquiryCreateInput,
): Promise<GuestInquirySubmissionResult> => {
  const parsed = guestInquiryCreateInputSchema.safeParse(rawInput)
  if (!parsed.success) throw new InquiryCommunicationServiceError('invalid-input', 'The inquiry input is invalid.')
  const input = parsed.data
  const hash = guestInquiryRequestHash(input)
  const guestActorKey = `guest:${hash}`
  const nowMs = Date.now()

  const result = await runRetryableCommand(req, async () => {
    const replay = await findGuestInquiryReplay(req, guestActorKey, hash, nowMs)
    if (replay) return { deduped: true, inquiry: replay }
    await validateInquiryTarget(req, input)

    const now = new Date(nowMs).toISOString()
    const inquiry = asRecord(
      await req.payload.create({
        collection: 'patientClinicInquiries',
        context: { inquiryCommunicationCommand: true },
        data: {
          activitySequence: 1,
          clinic: input.clinicId,
          clinicNotificationSequence: 1,
          clinicUnreadEpoch: 0,
          clinicUnreadFloor: 0,
          consent: { accepted: true, acceptedAt: now, text: GUEST_INQUIRY_CONSENT_TEXT },
          creationActorKey: guestActorKey,
          creationRequestHash: hash,
          doctor: input.doctorId ?? null,
          email: input.email,
          externalSequence: 0,
          fullName: input.fullName,
          handlingStatus: 'submitted',
          lastActivityAt: now,
          lifecycle: 'open',
          message: input.message,
          phoneNumber: input.phoneNumber,
          preferredContactWindow: input.preferredContactWindow ?? null,
          revision: 0,
          status: 'submitted',
          treatment: input.treatmentId ?? null,
          treatmentTimeline: input.treatmentTimeline ?? null,
        },
        depth: 0,
        overrideAccess: true,
        req,
      } as never),
    )
    await createAuditEvent(req, inquiry, { id: 'system', kind: 'system' }, 'inquiry-created', 1, {
      targetId: String(inquiry.id),
      targetType: 'inquiry',
    })
    return { deduped: false, inquiry }
  })

  return { deduped: result.deduped, id: String(result.inquiry.id), status: 'submitted' }
}
