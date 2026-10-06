import type { PayloadRequest } from 'payload'
import {
  APPEAL_DECIDED_SUBJECT,
  AppealDecidedEmail,
  type ReportCategory,
  type AppealAppellantDecisionStatus,
} from '@findmydoc-platform/email-templates'
import { render, toPlainText } from '@react-email/render'
import { isClinicStaffAccessReady, readClinicAccessState } from '@/auth/utilities/clinicAccessState'
import { getClinicDashboardOrigin } from '@/auth/utilities/clinicDashboardOrigin'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import { hasInquiryPackageHardDeleteBarrier } from '@/features/inquiryAggregate/tombstones'
import type { ClinicStaff } from '@/payload-types'
import type { CatalogEntry, CatalogRevalidation } from './catalog'
import type { TransactionalEmailCommand } from './commands'
import { TransactionalEmailError } from './errors'

type Command = Extract<TransactionalEmailCommand, { type: 'moderation.appeal-decided' }>
type Source = Record<string, unknown> & { id: number | string }
type Outcome = 'ineligible' | 'source-unavailable' | 'recipient-changed' | 'superseded'
const categories = {
  'harassment-threats': 'Harassment, threats, or inappropriate conduct',
  'spam-fraud-impersonation': 'Spam, fraud, or impersonation',
  'suspected-illegal-content': 'Suspected illegal content',
  'privacy-concern': 'Privacy concern or wrong recipient',
  other: 'Other',
} as const satisfies Record<string, ReportCategory>
const suppressed = (outcomeCode: Outcome) => ({ status: 'suppressed' as const, outcomeCode })

function id(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object' && 'id' in value) return id(value.id)
  return null
}

async function find(req: PayloadRequest, collection: string, recordId: unknown): Promise<Source | null> {
  const record = id(recordId)
  if (!record) return null
  const result = await req.payload.find({
    collection: collection as never,
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
    where: { id: { equals: record } },
  } as never)
  return (result.docs[0] as Source | undefined) ?? null
}

function patientInquiryUrl(inquiryId: string) {
  const origin = new URL(process.env.NEXT_PUBLIC_SERVER_URL ?? '')
  if (
    !['https:', 'http:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new TransactionalEmailError('source-missing')
  return new URL(`/patient/inquiries/${encodeURIComponent(inquiryId)}`, origin).toString()
}

/** Final appeal events address only their stored participants, never their platform decision actor. */
export function createModerationAppealDecidedCatalogEntry(req: PayloadRequest): CatalogEntry<Command> {
  async function load(command: Command, actor?: string | null) {
    const event = await find(req, 'inquiryModerationEvents', command.moderationEventId)
    if (!event || event.eventType !== 'appeal-decided' || event.actorKind !== 'platform')
      return suppressed('source-unavailable')
    const appeal = await find(req, 'inquiryModerationCases', event.moderationCase)
    const category =
      appeal && Object.hasOwn(categories, String(appeal.decisionCategory))
        ? categories[appeal.decisionCategory as keyof typeof categories]
        : null
    if (
      !appeal ||
      !category ||
      !['upheld', 'overturned'].includes(String(event.toValue)) ||
      appeal.appealOutcome !== event.toValue ||
      id(event.actorId) !== id(appeal.appealDecidedBy) ||
      !appeal.appealDecidedAt ||
      ['inquiry', 'clinic', 'patient', 'conversation'].some((field) => id(event[field]) !== id(appeal[field]))
    )
      return suppressed('source-unavailable')
    const participants = await req.payload.find({
      collection: 'inquiryModerationEvents',
      depth: 0,
      limit: 2,
      pagination: false,
      overrideAccess: true,
      req,
      where: {
        and: [
          { moderationCase: { equals: appeal.id } },
          { eventType: { in: ['appeal-submitted', 'report-received'] } },
          { sequence: { less_than: event.sequence } },
        ],
      },
    })
    const submitted = participants.docs.find((candidate) => candidate.eventType === 'appeal-submitted')
    const reported = participants.docs.find((candidate) => candidate.eventType === 'report-received')
    const appellantKind = submitted?.actorKind
    const appellantCollection =
      appellantKind === 'patient' ? 'patients' : appellantKind === 'clinic' ? 'clinicStaff' : null
    const appellantId = id(submitted?.actorId)
    const reporterKind = reported?.actorKind
    const reporterCollection =
      reporterKind === 'patient' ? 'patients' : reporterKind === 'clinic' ? 'clinicStaff' : null
    const reporterId = id(reported?.actorId)
    if (
      !submitted ||
      !reported ||
      !appellantCollection ||
      !appellantId ||
      !reporterCollection ||
      !reporterId ||
      appeal.appealActorKind !== appellantKind ||
      appeal.affectedActorKind !== appellantKind ||
      appeal.reporterKind !== reporterKind ||
      appeal.reporterKey !== `${reporterCollection}:${reporterId}` ||
      ['inquiry', 'clinic', 'patient', 'conversation'].some(
        (field) =>
          id(submitted[field as keyof typeof submitted]) !== id(event[field]) ||
          id(reported[field as keyof typeof reported]) !== id(event[field]),
      )
    )
      return suppressed('source-unavailable')
    if (actor !== undefined) {
      if (actor !== `platformStaff:${id(event.actorId)}`) throw new TransactionalEmailError('access-denied')
      const moderator = await find(req, 'platformStaff', event.actorId)
      if (
        !moderator ||
        !Array.isArray(moderator.capabilities) ||
        !moderator.capabilities.includes('conversation-moderation')
      )
        throw new TransactionalEmailError('access-denied')
    }
    if (
      command.recipientSlot === 'reporter' &&
      appellantCollection === reporterCollection &&
      appellantId === reporterId
    )
      return suppressed('source-unavailable')
    const kind = command.recipientSlot === 'appellant' ? appellantKind : reporterKind
    const collection = command.recipientSlot === 'appellant' ? appellantCollection : reporterCollection
    const recipientId = command.recipientSlot === 'appellant' ? appellantId : reporterId
    const binding = JSON.stringify([
      'moderation-appeal-decision-v1',
      event.id,
      appeal.id,
      command.recipientSlot,
      id(event.inquiry),
      id(event.conversation),
      id(event.clinic),
      id(event.patient),
      collection,
      recipientId,
      appeal.decisionCategory,
      event.toValue,
      appeal.effectiveUntil ?? null,
    ])
    const terminal = (outcomeCode: Outcome) => ({ ...suppressed(outcomeCode), binding })
    const decisionAt = Date.parse(String(appeal.appealDecidedAt))
    const endAt = typeof appeal.effectiveUntil === 'string' ? Date.parse(appeal.effectiveUntil) : null
    const endedAtDecision =
      (typeof appeal.measureEndedAt === 'string' && Date.parse(appeal.measureEndedAt) <= decisionAt) ||
      (endAt !== null && endAt <= decisionAt)
    if (
      command.recipientSlot === 'appellant' &&
      event.toValue === 'upheld' &&
      !endedAtDecision &&
      (appeal.measureEndedAt || (endAt !== null && endAt <= Date.now()))
    )
      return terminal('superseded')
    const currentRecipientId = id(
      command.recipientSlot === 'appellant'
        ? appellantKind === 'patient'
          ? appeal.appealPatient
          : appeal.appealClinicStaff
        : reporterKind === 'patient'
          ? appeal.reporterPatient
          : appeal.reporterClinicStaff,
    )
    const currentAffectedId = id(appellantKind === 'patient' ? appeal.affectedPatient : appeal.affectedClinicStaff)
    if (
      (currentRecipientId !== null && currentRecipientId !== recipientId) ||
      (command.recipientSlot === 'appellant' && currentAffectedId !== null && currentAffectedId !== appellantId)
    )
      return terminal('recipient-changed')
    const inquiry = await find(req, 'patientClinicInquiries', event.inquiry)
    const conversation = await find(req, 'inquiryConversations', event.conversation)
    if (!inquiry || !conversation) return terminal('source-unavailable')
    if (
      ['clinic', 'patient'].some((field) => id(inquiry[field]) !== id(event[field])) ||
      ['inquiry', 'clinic', 'patient'].some((field) => id(conversation[field]) !== id(event[field])) ||
      (kind === 'patient' && id(event.patient) !== recipientId)
    )
      return terminal('recipient-changed')
    const recipient = await find(req, collection, recipientId)
    if (recipient && kind === 'clinic' && id(recipient.clinic) !== id(event.clinic))
      return terminal('recipient-changed')
    if (
      !recipient ||
      recipient.deletedAt ||
      typeof recipient.email !== 'string' ||
      !isValidEmail(normalizeEmail(recipient.email)) ||
      inquiry.retentionState === 'hard-deleted' ||
      (await hasInquiryPackageHardDeleteBarrier(req, inquiry.id)) ||
      (kind === 'patient' && inquiry.retentionState !== 'available')
    )
      return terminal('ineligible')
    if (currentRecipientId === null || (command.recipientSlot === 'appellant' && currentAffectedId === null))
      return terminal('recipient-changed')
    if (kind === 'clinic') {
      if (!isClinicStaffAccessReady(recipient as unknown as ClinicStaff)) return terminal('ineligible')
      const access = await readClinicAccessState(req.payload, recipient.id, req)
      if (!access || id(access.clinic.id) !== id(event.clinic)) return terminal('ineligible')
    }
    const status: AppealAppellantDecisionStatus =
      event.toValue === 'overturned'
        ? 'restriction-lifted'
        : endedAtDecision
          ? 'restriction-ended'
          : 'restriction-remains'
    return {
      status: 'resolved' as const,
      address: normalizeEmail(recipient.email),
      binding,
      category,
      kind,
      audience: command.recipientSlot,
      appellantStatus: status,
      reporterStatus: event.toValue === 'overturned' ? ('no-action' as const) : ('action-taken' as const),
      effectiveUntil:
        typeof appeal.effectiveUntil === 'string' && Date.parse(appeal.effectiveUntil) > Date.now()
          ? appeal.effectiveUntil
          : undefined,
      inquiryId: String(inquiry.id),
    }
  }
  return {
    isRecipientAllowed: () => true,
    async authorizeAndResolve(command, actor) {
      const source = await load(command, actor)
      if (source.status !== 'resolved') {
        if (!('binding' in source) || typeof source.binding !== 'string')
          throw new TransactionalEmailError('source-missing')
        return { status: 'suppressed', binding: source.binding, outcomeCode: source.outcomeCode }
      }
      return { address: source.address, binding: source.binding }
    },
    async revalidate(command): Promise<CatalogRevalidation> {
      const source = await load(command)
      if (source.status !== 'resolved') return source
      return {
        status: 'eligible',
        recipient: { address: source.address, binding: source.binding },
        async prepare() {
          const actionUrl =
            source.kind === 'patient'
              ? patientInquiryUrl(source.inquiryId)
              : new URL(`/?inquiry=${encodeURIComponent(source.inquiryId)}`, getClinicDashboardOrigin()).toString()
          const html = await render(
            source.audience === 'appellant' ? (
              <AppealDecidedEmail
                audience="appellant"
                status={source.appellantStatus}
                decisionCategory={source.category}
                actionUrl={actionUrl}
                effectiveUntil={source.appellantStatus === 'restriction-remains' ? source.effectiveUntil : undefined}
              />
            ) : (
              <AppealDecidedEmail
                audience="original-reporter"
                status={source.reporterStatus}
                decisionCategory={source.category}
                actionUrl={actionUrl}
              />
            ),
          )
          return { recipientAddress: source.address, subject: APPEAL_DECIDED_SUBJECT, html, text: toPlainText(html) }
        },
      }
    },
  }
}
