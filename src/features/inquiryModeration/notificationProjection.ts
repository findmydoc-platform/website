import type { PayloadRequest } from 'payload'
import { readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'
import { readClinicInquiryNotificationProjection } from '@/features/inquiryCommunication/service'
import type { NotificationMember } from '@/features/clinicNotifications/contracts'

type Stored = Record<string, unknown> & { id: string | number }
const idOf = (value: unknown): string | null => {
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  return value && typeof value === 'object' && 'id' in value ? idOf(value.id) : null
}
const payloadId = (value: string): string | number =>
  /^[1-9]\d*$/u.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : value
async function findOne(
  req: PayloadRequest,
  collection: string,
  where: Record<string, unknown>,
): Promise<Stored | undefined> {
  const result = await req.payload.find({
    collection: collection as never,
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
    where,
  } as never)
  return result.docs[0] as Stored | undefined
}

/** Final appeal outcomes require the exact current affected actor and original appeal evidence. */
export async function readInquiryModerationNotificationProjection(
  req: PayloadRequest,
  member: NotificationMember,
  clinicId: string,
): Promise<{ visible: false } | { visible: true; displayName?: string }> {
  if (member.sourceRecord.kind !== 'inquiry') return { visible: false }
  const projection = await readClinicInquiryNotificationProjection(req, member.sourceRecord.id, clinicId)
  if (!projection.visible || member.eventType !== 'inquiry_appeal_decided') return projection
  if (req.user?.collection !== 'clinicStaff') return { visible: false }
  const access = await readClinicTargetAccess(req.payload, req.user.id, clinicId, req)
  if (!access) return { visible: false }
  const event = await findOne(req, 'inquiryModerationEvents', {
    and: [
      { id: { equals: payloadId(member.sourceOccurrence.id) } },
      { eventType: { equals: 'appeal-decided' } },
      { inquiry: { equals: payloadId(member.sourceRecord.id) } },
      { clinic: { equals: access.clinic.id } },
    ],
  })
  const caseId = idOf(event?.moderationCase)
  if (!event || !caseId) return { visible: false }
  const moderationCase = await findOne(req, 'inquiryModerationCases', { id: { equals: payloadId(caseId) } })
  if (
    !moderationCase ||
    idOf(moderationCase.inquiry) !== member.sourceRecord.id ||
    idOf(moderationCase.clinic) !== String(access.clinic.id) ||
    moderationCase.affectedActorKind !== 'clinic' ||
    idOf(moderationCase.affectedClinicStaff) !== String(access.staff.id) ||
    moderationCase.appealActorKind !== 'clinic' ||
    idOf(moderationCase.appealClinicStaff) !== String(access.staff.id)
  )
    return { visible: false }
  const outcome =
    moderationCase.appealOutcome === 'upheld'
      ? 'confirmed'
      : moderationCase.appealOutcome === 'overturned'
        ? 'lifted'
        : null
  if (outcome !== member.outcome) return { visible: false }
  const submitted = await findOne(req, 'inquiryModerationEvents', {
    and: [
      { moderationCase: { equals: payloadId(caseId) } },
      { eventType: { equals: 'appeal-submitted' } },
      { sequence: { less_than: event.sequence } },
    ],
  })
  return submitted?.actorKind === 'clinic' && submitted.actorId === String(access.staff.id)
    ? projection
    : { visible: false }
}
