import type { PayloadRequest } from 'payload'
import { readClinicInquiryNotificationProjection } from '@/features/inquiryCommunication/service'
import type { NotificationMember } from './contracts'

/** Feed and acknowledgements share current notification authorization, independently of destination availability. */
export function readNotificationSourceProjection(
  req: PayloadRequest,
  source: NotificationMember['sourceRecord'],
): Promise<{ visible: false } | { visible: true; displayName?: string }> {
  return source.kind === 'inquiry'
    ? readClinicInquiryNotificationProjection(req, source.id)
    : Promise.resolve({ visible: true })
}
