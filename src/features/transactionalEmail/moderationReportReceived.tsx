import type { PayloadRequest } from 'payload'
import { REPORT_RECEIVED_SUBJECT, ReportReceivedEmail, type ReportCategory } from '@findmydoc-platform/email-templates'
import { render, toPlainText } from '@react-email/render'
import { isClinicStaffAccessReady, readClinicAccessState } from '@/auth/utilities/clinicAccessState'
import { getClinicDashboardOrigin } from '@/auth/utilities/clinicDashboardOrigin'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import { hasInquiryPackageHardDeleteBarrier } from '@/features/inquiryAggregate/tombstones'
import type { ClinicStaff } from '@/payload-types'
import type { CatalogEntry, CatalogRevalidation } from './catalog'
import type { TransactionalEmailCommand } from './commands'
import { TransactionalEmailError } from './errors'

type Command = Extract<TransactionalEmailCommand, { type: 'moderation.report-received' }>
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

/** The report event owns the recipient; current participant access owns delivery eligibility. */
export function createModerationReportReceivedCatalogEntry(req: PayloadRequest): CatalogEntry<Command> {
  async function load(command: Command, actor?: string | null) {
    const event = await find(req, 'inquiryModerationEvents', command.moderationEventId)
    if (!event || event.eventType !== 'report-received' || event.sequence !== 1 || command.recipientSlot !== 'reporter')
      return suppressed('source-unavailable')
    const report = await find(req, 'inquiryModerationCases', event.moderationCase)
    const kind = report?.reporterKind
    const collection = kind === 'patient' ? 'patients' : kind === 'clinic' ? 'clinicStaff' : null
    const recipientId = id(kind === 'patient' ? report?.reporterPatient : report?.reporterClinicStaff)
    const category =
      report && Object.hasOwn(categories, String(report.category))
        ? categories[report.category as keyof typeof categories]
        : null
    if (
      !report ||
      !collection ||
      !recipientId ||
      !category ||
      event.actorKind !== kind ||
      id(event.actorId) !== recipientId ||
      report.reporterKey !== `${collection}:${recipientId}` ||
      ['inquiry', 'clinic', 'patient', 'conversation'].some((field) => id(event[field]) !== id(report[field]))
    )
      return suppressed('source-unavailable')
    const authorizedActor = `${collection}:${recipientId}`
    if (actor !== undefined && actor !== authorizedActor) throw new TransactionalEmailError('access-denied')
    const binding = JSON.stringify([
      'moderation-report-v1',
      event.id,
      report.id,
      id(report.inquiry),
      id(report.conversation),
      id(report.clinic),
      id(report.patient),
      collection,
      recipientId,
    ])
    const terminal = (outcomeCode: Outcome) => ({ ...suppressed(outcomeCode), binding })
    const laterDecision = await req.payload.find({
      collection: 'inquiryModerationEvents',
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
      where: {
        and: [
          { moderationCase: { equals: report.id } },
          { eventType: { equals: 'decision-recorded' } },
          { sequence: { greater_than: event.sequence } },
        ],
      },
    })
    if (laterDecision.docs.length) return terminal('superseded')
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
    // A moved staff participant is a binding change, even if their new clinic is not eligible.
    if (recipient && kind === 'clinic' && id(recipient.clinic) !== id(report.clinic))
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
      // Reject incomplete staff before the access reader's optional legacy evidence import path.
      if (!isClinicStaffAccessReady(recipient as unknown as ClinicStaff)) return terminal('ineligible')
      const access = await readClinicAccessState(req.payload, recipient.id, req)
      if (!access || id(access.clinic.id) !== id(report.clinic)) return terminal('ineligible')
    }
    return {
      status: 'resolved' as const,
      actor: authorizedActor,
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
          const html = await render(<ReportReceivedEmail category={source.category} actionUrl={actionUrl} />)
          return { recipientAddress: source.address, subject: REPORT_RECEIVED_SUBJECT, html, text: toPlainText(html) }
        },
      }
    },
  }
}
