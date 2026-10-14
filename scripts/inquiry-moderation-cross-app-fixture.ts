import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { readClinicInquiryDetail, sendClinicInquiryMessage } from '@/features/inquiryCommunication/service'
import {
  createInquiryModerationReport,
  decideInquiryModerationCase,
  submitInquiryModerationAppeal,
  decideInquiryModerationAppeal,
} from '@/features/inquiryModeration/service'
import { readClinicNotifications } from '@/features/clinicNotifications/service'
import { createPlatformTestUser } from '../tests/fixtures/testUsers'

/** Local cross-app fixture calls the ordinary source commands against the isolated test database. */
export async function inquiryModerationCrossAppFixture(input: {
  payload: Payload
  clinicId: number
  inquiryId: string
  patientReq: PayloadRequest
  clinicReq: PayloadRequest
}): Promise<Record<string, () => Promise<unknown>>> {
  const { payload, inquiryId, patientReq, clinicReq } = input
  const moderator = await createPlatformTestUser(payload, { emailPrefix: 'cross-app-notification-moderator' })
  const authorized = await payload.update({
    collection: 'platformStaff',
    id: moderator.id,
    data: { capabilities: ['conversation-moderation'] },
    context: { trustedPlatformStaffOps: true },
    overrideAccess: true,
    depth: 0,
  })
  const moderatorReq = await createLocalReq({}, payload)
  moderatorReq.user = { ...authorized, collection: 'platformStaff' }
  let caseId: string | undefined
  const result = async () => {
    const response = await readClinicNotifications(clinicReq, { mode: 'page', view: 'all' })
    if (response.mode !== 'page') throw new Error('Expected notification page')
    return {
      inquiryId,
      items: response.items.filter(
        (item) => item.destination.kind === 'inquiry' && item.destination.inquiryId === inquiryId,
      ),
    }
  }
  return {
    '/notification-restrict-inquiry': async () => {
      const detail = await readClinicInquiryDetail(clinicReq, { inquiryId })
      const sent = await sendClinicInquiryMessage(clinicReq, {
        inquiryId,
        expectedRevision: detail.inquiry.revision,
        idempotencyKey: 'cross-app-moderation-notification-message',
        text: 'Protected clinic content',
      })
      const target = sent.inquiry.timeline.find(
        (item) => item.kind === 'external-message' && item.actor.kind === 'clinic',
      )
      if (!target) throw new Error('Expected ordinary clinic message')
      const report = await createInquiryModerationReport(patientReq, {
        inquiryId,
        targetId: target.id,
        targetType: 'message',
        category: 'privacy-concern',
        idempotencyKey: 'cross-app-moderation-notification-report',
        description: 'Private report description',
      })
      caseId = report.reportId
      await decideInquiryModerationCase(moderatorReq, {
        caseId,
        category: 'privacy-concern',
        outcome: 'content-restricted',
        reason: 'Private moderation reason',
      })
      return result()
    },
    '/notification-overturn-inquiry': async () => {
      if (!caseId) throw new Error('Expected existing restriction')
      await submitInquiryModerationAppeal(clinicReq, { caseId, text: 'Private appeal text' })
      await decideInquiryModerationAppeal(moderatorReq, {
        caseId,
        outcome: 'overturned',
        reason: 'Private final reason',
      })
      return result()
    },
  }
}
