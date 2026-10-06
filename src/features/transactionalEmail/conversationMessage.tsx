import {
  CONVERSATION_MESSAGE_SUBJECT,
  ConversationMessageEmail,
  type ConversationMessageEmailProps,
} from '@findmydoc-platform/email-templates'
import { render, toPlainText } from '@react-email/render'
import type { PayloadRequest } from 'payload'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import {
  hasInquiryPackageHardDeleteBarrier,
  inquiryPackageTombstoneKey,
  isInquiryContentHardDeleted,
  readInquiryHardDeleteTombstones,
} from '@/features/inquiryAggregate/tombstones'
import { INQUIRY_ATTACHMENT_MIME_TYPES } from '@/features/inquiryCommunication/contracts'
import { readInquiryModerationState } from '@/features/inquiryModeration/service'
import type { CatalogEntry, CatalogRevalidation } from './catalog'
import type { TransactionalEmailCommand } from './commands'
import type { EmailEnvironment } from './environment'
import { TransactionalEmailError } from './errors'

type Command = Extract<TransactionalEmailCommand, { type: 'conversation.external-message-received' }>
const origins: Record<EmailEnvironment, string> = {
  preview: 'https://preview.findmydoc.eu',
  production: 'https://findmydoc.eu',
  local: 'http://localhost:3000',
  test: 'https://example.test',
  ci: 'https://example.test',
}

function relationId(value: number | string | { id: number | string } | null | undefined) {
  return value && typeof value === 'object' ? value.id : (value ?? null)
}

async function available<Source>(read: () => Promise<Source>): Promise<Source | null> {
  try {
    return await read()
  } catch (error) {
    if (error && typeof error === 'object') {
      const sourceError = error as { name?: unknown; status?: unknown; statusCode?: unknown }
      if (sourceError.name === 'NotFound' || sourceError.status === 404 || sourceError.statusCode === 404) return null
    }
    throw error
  }
}

/** Message identity is the only input; recipient and protected link remain Website-owned. */
export function createConversationMessageCatalogEntry(
  req: PayloadRequest,
  environment: EmailEnvironment,
): CatalogEntry<Command> {
  async function revalidate(command: Command, actor?: string | null): Promise<CatalogRevalidation> {
    const message = await available(() =>
      req.payload.findByID({
        collection: 'inquiryMessages',
        id: command.messageId,
        depth: 0,
        overrideAccess: true,
        req,
        select: {
          inquiry: true,
          conversation: true,
          clinic: true,
          patient: true,
          authorKind: true,
          authorClinicStaff: true,
          contentState: true,
          text: true,
          attachment: true,
          deletedAt: true,
        },
      }),
    )
    if (!message || message.deletedAt) return { status: 'suppressed', outcomeCode: 'source-unavailable' }
    if (
      actor !== undefined &&
      (message.authorKind !== 'clinic' || actor !== `clinicStaff:${relationId(message.authorClinicStaff)}`)
    )
      throw new TransactionalEmailError('access-denied')
    if (message.authorKind !== 'clinic') return { status: 'suppressed', outcomeCode: 'ineligible' }
    const inquiryId = relationId(message.inquiry)
    const conversationId = relationId(message.conversation)
    if (inquiryId === null || conversationId === null) return { status: 'suppressed', outcomeCode: 'ineligible' }
    const inquiry = await available(() =>
      req.payload.findByID({
        collection: 'patientClinicInquiries',
        id: inquiryId,
        depth: 0,
        overrideAccess: true,
        req,
        select: { patient: true, clinic: true, retentionState: true, deletedAt: true },
      }),
    )
    const conversation = await available(() =>
      req.payload.findByID({
        collection: 'inquiryConversations',
        id: conversationId,
        depth: 0,
        overrideAccess: true,
        req,
        select: { inquiry: true, clinic: true, patient: true, deletedAt: true },
      }),
    )
    if (!inquiry || !conversation || inquiry.deletedAt || conversation.deletedAt)
      return { status: 'suppressed', outcomeCode: 'ineligible' }
    if (
      inquiry.retentionState !== 'available' ||
      String(relationId(conversation.inquiry)) !== String(inquiry.id) ||
      String(relationId(conversation.clinic)) !== String(relationId(inquiry.clinic)) ||
      String(relationId(message.clinic)) !== String(relationId(inquiry.clinic))
    )
      return { status: 'suppressed', outcomeCode: 'ineligible' }
    const patientId = relationId(inquiry.patient)
    if (patientId === null) return { status: 'suppressed', outcomeCode: 'ineligible' }
    if (
      String(relationId(message.patient)) !== String(patientId) ||
      String(relationId(conversation.patient)) !== String(patientId)
    )
      return { status: 'suppressed', outcomeCode: 'recipient-changed' }
    const patient = await available(() =>
      req.payload.findByID({
        collection: 'patients',
        id: patientId,
        depth: 0,
        overrideAccess: true,
        req,
        select: { email: true, deletedAt: true },
      }),
    )
    if (!patient || patient.deletedAt) return { status: 'suppressed', outcomeCode: 'ineligible' }
    const address = normalizeEmail(patient.email)
    if (!isValidEmail(address)) return { status: 'suppressed', outcomeCode: 'ineligible' }
    if (await hasInquiryPackageHardDeleteBarrier(req, inquiry.id))
      return { status: 'suppressed', outcomeCode: 'ineligible' }
    const anonymization = await req.payload.find({
      collection: 'inquiryDeletionProofs',
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
      select: { tombstoneKey: true },
      where: { tombstoneKey: { equals: inquiryPackageTombstoneKey(inquiry.id, 'anonymized') } },
    })
    if (anonymization.docs.length) return { status: 'suppressed', outcomeCode: 'ineligible' }
    const tombstones = await readInquiryHardDeleteTombstones(req, inquiry.id)
    const moderation = await readInquiryModerationState(req, inquiry.id, { id: patient.id, kind: 'patient' })
    if (
      isInquiryContentHardDeleted(tombstones, {
        contentState: message.contentState,
        inquiryId: inquiry.id,
        targetId: message.id,
        targetType: 'message',
      }) ||
      moderation.restrictedMessageIds.has(String(message.id))
    )
      return { status: 'suppressed', outcomeCode: 'ineligible' }
    if (!message.text?.trim()) {
      const attachmentId = relationId(message.attachment)
      const attachment =
        attachmentId === null
          ? null
          : await available(() =>
              req.payload.findByID({
                collection: 'inquiryAttachments',
                id: attachmentId,
                depth: 0,
                overrideAccess: true,
                req,
                select: {
                  inquiry: true,
                  clinic: true,
                  patient: true,
                  boundMessage: true,
                  state: true,
                  contentState: true,
                  verifiedMimeType: true,
                },
              }),
            )
      if (
        !attachment ||
        attachment.state !== 'bound' ||
        String(relationId(attachment.inquiry)) !== String(inquiry.id) ||
        String(relationId(attachment.clinic)) !== String(relationId(inquiry.clinic)) ||
        String(relationId(attachment.patient)) !== String(patient.id) ||
        String(relationId(attachment.boundMessage)) !== String(message.id) ||
        !INQUIRY_ATTACHMENT_MIME_TYPES.some((mimeType) => mimeType === attachment.verifiedMimeType) ||
        moderation.restrictedAttachmentIds.has(String(attachment.id)) ||
        isInquiryContentHardDeleted(tombstones, {
          contentState: attachment.contentState,
          inquiryId: inquiry.id,
          targetId: attachment.id,
          targetType: 'attachment',
        })
      )
        return { status: 'suppressed', outcomeCode: 'ineligible' }
    }
    const recipient = {
      address,
      binding: JSON.stringify(['conversation-message-v1', message.id, inquiry.id, conversation.id, patient.id]),
    }
    return {
      status: 'eligible',
      recipient,
      async prepare() {
        const props: ConversationMessageEmailProps = {
          actionUrl: new URL(
            `/patient/inquiries/${encodeURIComponent(String(inquiry.id))}`,
            origins[environment],
          ).toString(),
        }
        const html = await render(<ConversationMessageEmail {...props} />)
        return {
          recipientAddress: recipient.address,
          subject: CONVERSATION_MESSAGE_SUBJECT,
          html,
          text: toPlainText(html),
        }
      },
    }
  }
  return {
    isRecipientAllowed: () => true,
    async authorizeAndResolve(command, actor) {
      const decision = await revalidate(command, actor)
      if (decision.status !== 'eligible') throw new TransactionalEmailError('source-missing')
      return decision.recipient
    },
    revalidate,
  }
}
