import type { PayloadRequest } from 'payload'
import { readInquiryModerationNotificationProjection } from '@/features/inquiryModeration/notificationProjection'
import type { NotificationMember } from './contracts'
import { readClinicReviewNotificationProjection } from './reviewProjection'

/** Feed and acknowledgements share current notification authorization, independently of destination availability. */
export function readNotificationSourceProjection(
  req: PayloadRequest,
  member: NotificationMember,
): Promise<{ visible: false } | { visible: true; displayName?: string; rating?: number }> {
  return member.sourceRecord.kind === 'inquiry'
    ? readInquiryModerationNotificationProjection(req, member)
    : readClinicReviewNotificationProjection(req, member)
}
