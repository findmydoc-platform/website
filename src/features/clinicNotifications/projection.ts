import type { PayloadRequest } from 'payload'
import { readInquiryModerationNotificationProjection } from '@/features/inquiryModeration/notificationProjection'
import { InquiryCommunicationServiceError } from '@/features/inquiryCommunication/service'
import type { NotificationMember } from './contracts'
import { readClinicReviewNotificationProjection } from './reviewProjection'

/** Feed and acknowledgements share current notification authorization, independently of destination availability. */
async function readNotificationSourceProjection(
  req: PayloadRequest,
  member: NotificationMember,
  clinicId: string,
): Promise<{ visible: false } | { visible: true; displayName?: string; rating?: number }> {
  try {
    return await (member.sourceRecord.kind === 'inquiry'
      ? readInquiryModerationNotificationProjection(req, member, clinicId)
      : readClinicReviewNotificationProjection(req, member, clinicId))
  } catch (error) {
    if (error instanceof InquiryCommunicationServiceError && ['access-denied', 'unauthorized'].includes(error.kind))
      return { visible: false }
    throw error
  }
}

/** Deduplicates source reads inside one feed scan or locked command phase, never across requests or phases. */
export function createNotificationSourceProjector(req: PayloadRequest) {
  const projections = new Map<string, ReturnType<typeof readNotificationSourceProjection>>()
  return (member: NotificationMember, clinicId: string) => {
    const key = JSON.stringify([
      clinicId,
      member.sourceRecord.kind,
      member.sourceRecord.id,
      ...(member.eventType === 'inquiry_appeal_decided' ? [member.sourceOccurrence.id, member.outcome] : []),
    ])
    let projection = projections.get(key)
    if (!projection) {
      projection = readNotificationSourceProjection(req, member, clinicId)
      projections.set(key, projection)
    }
    return projection
  }
}
