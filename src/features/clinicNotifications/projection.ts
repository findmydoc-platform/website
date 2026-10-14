import type { PayloadRequest } from 'payload'
import { readClinicInquiryNotificationProjection } from '@/features/inquiryCommunication/service'
import type { NotificationMember } from './contracts'

/** Feed and acknowledgements share current notification authorization, independently of destination availability. */
export function readNotificationSourceProjection(
  req: PayloadRequest,
  member: NotificationMember,
): Promise<{ visible: false } | { visible: true; displayName?: string }> {
  return member.sourceRecord.kind === 'inquiry'
    ? readClinicInquiryNotificationProjection(req, member.sourceRecord.id)
    : Promise.resolve({ visible: true })
}
