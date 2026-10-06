import type { PayloadRequest } from 'payload'
import { APPEAL_RECEIVED_SUBJECT, AppealReceivedEmail, type ReportCategory } from '@findmydoc-platform/email-templates'
import { render, toPlainText } from '@react-email/render'
import { isClinicStaffAccessReady, readClinicAccessState } from '@/auth/utilities/clinicAccessState'
import { getClinicDashboardOrigin } from '@/auth/utilities/clinicDashboardOrigin'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import { hasInquiryPackageHardDeleteBarrier } from '@/features/inquiryAggregate/tombstones'
import type { ClinicStaff } from '@/payload-types'
import type { CatalogEntry, CatalogRevalidation } from './catalog'
import type { TransactionalEmailCommand } from './commands'
import { TransactionalEmailError } from './errors'

type Command = Extract<TransactionalEmailCommand, { type: 'moderation.appeal-received' }>
type RecordSource = Record<string, unknown> & { id: number | string }
type Outcome = 'ineligible' | 'source-unavailable' | 'recipient-changed' | 'superseded'

const categories = {
  'harassment-threats': 'Harassment, threats, or inappropriate conduct',
  'spam-fraud-impersonation': 'Spam, fraud, or impersonation',
  'suspected-illegal-content': 'Suspected illegal content',
  'privacy-concern': 'Privacy concern or wrong recipient',
  other: 'Other',
} as const satisfies Record<string, ReportCategory>

function id(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object' && 'id' in value) return id(value.id)
  return null
}

const suppressed = (outcomeCode: Outcome) => ({ status: 'suppressed' as const, outcomeCode })

async function find(req: PayloadRequest, collection: string, recordId: unknown): Promise<RecordSource | null> {
  const sourceId = id(recordId)
  if (!sourceId) return null
  const result = await req.payload.find({
    collection: collection as never,
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
    where: { id: { equals: sourceId } },
  } as never)
  return (result.docs[0] as RecordSource | undefined) ?? null
}

function patientInquiryUrl(inquiryId: string): string {
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

/** The immutable appeal actor is the sole recipient, not everyone able to read the clinic Inquiry. */
export function createModerationAppealReceivedCatalogEntry(req: PayloadRequest): CatalogEntry<Command> {
  async function load(command: Command, actor?: string | null) {
    const event = await find(req, 'inquiryModerationEvents', command.moderationEventId)
    if (!event || event.eventType !== 'appeal-submitted' || command.recipientSlot !== 'appellant')
      return suppressed('source-unavailable')
    const appeal = await find(req, 'inquiryModerationCases', event.moderationCase)
    const kind = event.actorKind
    const collection = kind === 'patient' ? 'patients' : kind === 'clinic' ? 'clinicStaff' : null
    const recipientId = id(event.actorId)
    const category =
      appeal && Object.hasOwn(categories, String(appeal.decisionCategory))
        ? categories[appeal.decisionCategory as keyof typeof categories]
        : null
    if (
      !appeal ||
      !collection ||
      !recipientId ||
      !category ||
      !appeal.appealedAt ||
      ['inquiry', 'clinic', 'patient', 'conversation'].some((field) => id(event[field]) !== id(appeal[field]))
    )
      return suppressed('source-unavailable')
    const authorizedActor = `${collection}:${recipientId}`
    if (actor !== undefined && actor !== authorizedActor) throw new TransactionalEmailError('access-denied')
    const binding = JSON.stringify([
      'moderation-appeal-v1',
      event.id,
      appeal.id,
      id(event.inquiry),
      id(event.conversation),
      id(event.clinic),
      id(event.patient),
      collection,
      recipientId,
    ])
    const terminal = (outcomeCode: Outcome) => ({ ...suppressed(outcomeCode), binding })
    if (
      appeal.appealActorKind !== kind ||
      appeal.affectedActorKind !== kind ||
      id(kind === 'patient' ? appeal.appealPatient : appeal.appealClinicStaff) !== recipientId ||
      id(kind === 'patient' ? appeal.affectedPatient : appeal.affectedClinicStaff) !== recipientId
    )
      return terminal('recipient-changed')
    const laterDecision = await req.payload.find({
      collection: 'inquiryModerationEvents',
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
      where: {
        and: [
          { moderationCase: { equals: appeal.id } },
          { eventType: { equals: 'appeal-decided' } },
          { sequence: { greater_than: event.sequence } },
        ],
      },
    })
    if (laterDecision.docs.length) return terminal('superseded')
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
      !recipient.email.trim() ||
      !isValidEmail(normalizeEmail(recipient.email)) ||
      inquiry.retentionState === 'hard-deleted' ||
      (await hasInquiryPackageHardDeleteBarrier(req, inquiry.id))
    )
      return terminal('ineligible')
    if (kind === 'patient' && inquiry.retentionState !== 'available') return terminal('ineligible')
    if (kind === 'clinic') {
      if (!isClinicStaffAccessReady(recipient as unknown as ClinicStaff)) return terminal('ineligible')
      const access = await readClinicAccessState(req.payload, recipient.id, req)
      if (!access || id(access.clinic.id) !== id(event.clinic)) return terminal('ineligible')
    }
    return {
      status: 'resolved' as const,
      address: normalizeEmail(recipient.email),
      binding,
      category,
      inquiryId: String(inquiry.id),
      kind,
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
          const html = await render(<AppealReceivedEmail decisionCategory={source.category} actionUrl={actionUrl} />)
          return { recipientAddress: source.address, subject: APPEAL_RECEIVED_SUBJECT, html, text: toPlainText(html) }
        },
      }
    },
  }
}
