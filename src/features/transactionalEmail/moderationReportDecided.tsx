import type { PayloadRequest } from 'payload'
import {
  REPORT_DECIDED_SUBJECT,
  ReportDecidedEmail,
  type ReportCategory,
  type AffectedReportDecisionStatus,
} from '@findmydoc-platform/email-templates'
import { render, toPlainText } from '@react-email/render'
import { isClinicStaffAccessReady, readClinicAccessState } from '@/auth/utilities/clinicAccessState'
import { getClinicDashboardOrigin } from '@/auth/utilities/clinicDashboardOrigin'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import { hasInquiryPackageHardDeleteBarrier, inquiryPackageTombstoneKey } from '@/features/inquiryAggregate/tombstones'
import type { ClinicStaff } from '@/payload-types'
import type { CatalogEntry, CatalogRevalidation } from './catalog'
import type { TransactionalEmailCommand } from './commands'
import { TransactionalEmailError } from './errors'

type Command = Extract<TransactionalEmailCommand, { type: 'moderation.report-decided' }>
type Source = Record<string, unknown> & { id: number | string }
const categories = {
  'harassment-threats': 'Harassment, threats, or inappropriate conduct',
  'spam-fraud-impersonation': 'Spam, fraud, or impersonation',
  'suspected-illegal-content': 'Suspected illegal content',
  'privacy-concern': 'Privacy concern or wrong recipient',
  other: 'Other',
} as const satisfies Record<string, ReportCategory>
const suppressed = (outcomeCode: 'ineligible' | 'source-unavailable' | 'recipient-changed' | 'superseded') => ({
  status: 'suppressed' as const,
  outcomeCode,
})

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

export function createModerationReportDecidedCatalogEntry(req: PayloadRequest): CatalogEntry<Command> {
  async function hasAnonymizedPatientReporter(report: Source): Promise<boolean> {
    if (
      report.reporterKind !== 'patient' ||
      id(report.reporterPatient) !== null ||
      id(report.reporterClinicStaff) !== null ||
      report.reporterKey != null ||
      id(report.patient) !== null
    )
      return false
    const inquiry = await find(req, 'patientClinicInquiries', report.inquiry)
    const conversation = await find(req, 'inquiryConversations', report.conversation)
    if (
      !inquiry ||
      !conversation ||
      inquiry.retentionState !== 'anonymized' ||
      id(inquiry.patient) !== null ||
      id(conversation.patient) !== null ||
      id(inquiry.clinic) !== id(report.clinic) ||
      id(conversation.clinic) !== id(report.clinic) ||
      id(conversation.inquiry) !== id(inquiry.id)
    )
      return false
    const proof = await req.payload.find({
      collection: 'inquiryDeletionProofs',
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
      where: {
        and: [
          { inquiryId: { equals: String(inquiry.id) } },
          { tombstoneKey: { equals: inquiryPackageTombstoneKey(inquiry.id, 'anonymized') } },
          { operation: { equals: 'anonymized' } },
        ],
      },
    })
    return proof.docs.length > 0
  }

  async function load(command: Command, actor?: string | null) {
    const event = await find(req, 'inquiryModerationEvents', command.moderationEventId)
    if (!event || event.eventType !== 'decision-recorded' || event.actorKind !== 'platform')
      return suppressed('source-unavailable')
    const report = await find(req, 'inquiryModerationCases', event.moderationCase)
    const category =
      report && Object.hasOwn(categories, String(report.decisionCategory))
        ? categories[report.decisionCategory as keyof typeof categories]
        : null
    const reporterKind = report?.reporterKind
    const reporterCollection =
      reporterKind === 'patient' ? 'patients' : reporterKind === 'clinic' ? 'clinicStaff' : null
    const reporterId = id(reporterKind === 'patient' ? report?.reporterPatient : report?.reporterClinicStaff)
    if (
      !report ||
      !category ||
      !reporterCollection ||
      !['no-action', 'content-restricted', 'conversation-restricted', 'identity-messaging-suspended'].includes(
        String(event.toValue),
      ) ||
      report.decisionOutcome !== event.toValue ||
      id(event.actorId) !== id(report.decisionBy) ||
      ['inquiry', 'clinic', 'patient', 'conversation'].some((field) => id(event[field]) !== id(report[field]))
    )
      return suppressed('source-unavailable')
    if (
      (!reporterId || report.reporterKey !== `${reporterCollection}:${reporterId}`) &&
      !(await hasAnonymizedPatientReporter(report))
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
    const outcome = event.toValue as 'no-action' | AffectedReportDecisionStatus
    const kind = command.recipientSlot === 'reporter' ? reporterKind : report.affectedActorKind
    const collection = kind === 'patient' ? 'patients' : kind === 'clinic' ? 'clinicStaff' : null
    const recipientId =
      command.recipientSlot === 'reporter'
        ? reporterId
        : id(kind === 'patient' ? report.affectedPatient : report.affectedClinicStaff)
    const affectedCollection =
      report.affectedActorKind === 'patient' ? 'patients' : report.affectedActorKind === 'clinic' ? 'clinicStaff' : null
    const affectedId = id(report.affectedActorKind === 'patient' ? report.affectedPatient : report.affectedClinicStaff)
    if (
      !collection ||
      (command.recipientSlot === 'affected' && outcome === 'no-action') ||
      (command.recipientSlot === 'reporter' &&
        outcome !== 'no-action' &&
        affectedCollection === reporterCollection &&
        affectedId === reporterId)
    )
      return suppressed('source-unavailable')
    const binding = JSON.stringify([
      'moderation-decision-v1',
      event.id,
      report.id,
      command.recipientSlot,
      id(report.inquiry),
      id(report.conversation),
      id(report.clinic),
      id(report.patient),
      collection,
      recipientId,
      report.decisionCategory,
      outcome,
      report.effectiveUntil ?? null,
    ])
    const terminal = (outcomeCode: 'ineligible' | 'source-unavailable' | 'recipient-changed' | 'superseded') => ({
      ...suppressed(outcomeCode),
      binding,
    })
    if (!recipientId) return terminal('ineligible')
    if (
      report.appealOutcome === 'overturned' ||
      (command.recipientSlot === 'affected' &&
        (report.measureEndedAt ||
          (typeof report.effectiveUntil === 'string' && Date.parse(report.effectiveUntil) <= Date.now())))
    )
      return terminal('superseded')
    const inquiry = await find(req, 'patientClinicInquiries', report.inquiry)
    const conversation = await find(req, 'inquiryConversations', report.conversation)
    if (!inquiry || !conversation) return terminal('source-unavailable')
    if (
      ['clinic', 'patient'].some((field) => id(inquiry[field]) !== id(report[field])) ||
      ['inquiry', 'clinic', 'patient'].some((field) => id(conversation[field]) !== id(report[field])) ||
      (kind === 'patient' && id(report.patient) !== recipientId)
    )
      return terminal('recipient-changed')
    const recipient = await find(req, collection, recipientId)
    if (recipient && kind === 'clinic' && id(recipient.clinic) !== id(report.clinic))
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
    if (kind === 'clinic') {
      if (!isClinicStaffAccessReady(recipient as unknown as ClinicStaff)) return terminal('ineligible')
      const access = await readClinicAccessState(req.payload, recipient.id, req)
      if (!access || id(access.clinic.id) !== id(report.clinic)) return terminal('ineligible')
    }
    return {
      status: 'resolved' as const,
      address: normalizeEmail(recipient.email),
      binding,
      category,
      kind,
      audience: command.recipientSlot,
      outcome,
      effectiveUntil:
        typeof report.effectiveUntil === 'string' && Date.parse(report.effectiveUntil) > Date.now()
          ? report.effectiveUntil
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
            source.audience === 'affected' && source.outcome !== 'no-action' ? (
              <ReportDecidedEmail
                audience="affected"
                status={source.outcome}
                decisionCategory={source.category}
                actionUrl={actionUrl}
                effectiveUntil={source.effectiveUntil}
              />
            ) : (
              <ReportDecidedEmail
                audience="reporter"
                status={source.outcome === 'no-action' ? 'no-action' : 'action-taken'}
                decisionCategory={source.category}
                actionUrl={actionUrl}
              />
            ),
          )
          return { recipientAddress: source.address, subject: REPORT_DECIDED_SUBJECT, html, text: toPlainText(html) }
        },
      }
    },
  }
}
