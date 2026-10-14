import { createHash } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { readClinicAccessState } from '@/auth/utilities/clinicAccessState'
import { readNotificationSourceProjection } from './projection'
import {
  CLINIC_NOTIFICATIONS_CONTRACT_VERSION,
  NOTIFICATION_PAGE_MAX_BYTES,
  NOTIFICATION_PAGE_MAX_ENTRIES,
  notificationMemberSchema,
  notificationsResponseSchema,
  type NotificationItem,
  type NotificationMember,
  type NotificationReadQuery,
  type NotificationsResponse,
} from './contracts'

import { ClinicNotificationError } from './errors'
export { activateClinicNotificationsForTest } from './capture'
export { ClinicNotificationError } from './errors'

type Id = string | number
type Stored = Record<string, unknown> & { id: Id }
const idOf = (value: unknown): Id | null => {
  if (typeof value === 'string' || typeof value === 'number') return value
  return value && typeof value === 'object' && 'id' in value ? idOf(value.id) : null
}

async function allRows(req: PayloadRequest, collection: string, where: Record<string, unknown>): Promise<Stored[]> {
  const upper = await req.payload.find({
    collection: collection as never,
    where,
    depth: 0,
    limit: 1,
    sort: '-id',
    pagination: false,
    overrideAccess: true,
    req,
  } as never)
  const upperId = (upper.docs[0] as unknown as Stored | undefined)?.id
  if (upperId === undefined) return []
  const docs: Stored[] = []
  let lastId: Id | undefined
  for (;;) {
    const result = await req.payload.find({
      collection: collection as never,
      where: {
        and: [
          where,
          { id: { less_than_equal: upperId } },
          ...(lastId === undefined ? [] : [{ id: { greater_than: lastId } }]),
        ],
      },
      depth: 0,
      limit: 100,
      sort: 'id',
      pagination: true,
      overrideAccess: true,
      req,
    } as never)
    const batch = result.docs as unknown as Stored[]
    docs.push(...batch)
    if (!result.hasNextPage || !batch.length) return docs
    lastId = batch.at(-1)!.id
  }
}

const messageDestination = (member: NotificationMember): NotificationItem['destination'] => {
  const anchorId = `message:${member.sourceOccurrence.id}`
  return {
    kind: 'inquiry',
    inquiryId: member.sourceRecord.id,
    ...(anchorId.length <= 200 ? { anchor: { kind: 'message' as const, id: anchorId } } : {}),
  }
}

const labels: Record<NotificationMember['eventType'], string> = {
  inquiry_created: 'New inquiry',
  patient_message_received: 'New patient message',
  review_published: 'New review',
  clinic_response_decided: 'Review response decision',
  review_appeal_decided: 'Review appeal decision',
  inquiry_restricted: 'Inquiry restricted',
  inquiry_restored: 'Inquiry restored',
  inquiry_appeal_decided: 'Inquiry appeal decision',
  review_withdrawn: 'Review withdrawn',
  review_removed: 'Review removed',
}

export async function readClinicNotifications(
  req: PayloadRequest,
  input: NotificationReadQuery,
): Promise<NotificationsResponse> {
  if (!req.user || req.user.collection !== 'clinicStaff') throw new ClinicNotificationError('UNAUTHENTICATED')
  const access = await readClinicAccessState(req.payload, req.user.id, req)
  if (!access) throw new ClinicNotificationError('CLINIC_ACCESS_DENIED')
  if (input.mode === 'page' && input.cursor) throw new ClinicNotificationError('CURSOR_INVALID')
  const serverTime = new Date().toISOString()
  const occurrences = await allRows(req, 'clinicNotificationOccurrences', {
    and: [{ clinicScopeId: { equals: String(access.clinic.id) } }, { expiresAt: { greater_than: serverTime } }],
  })
  const receipts = await allRows(req, 'clinicNotificationReadReceipts', { clinicStaff: { equals: access.staff.id } })
  const readTimes = new Map(receipts.map((receipt) => [String(idOf(receipt.occurrence)), receipt.readAt]))
  const items: NotificationItem[] = []
  for (const occurrence of occurrences) {
    const parsed = notificationMemberSchema.safeParse({
      notificationId: occurrence.notificationId,
      schemaVersion: occurrence.schemaVersion,
      eventType: occurrence.eventType,
      sourceRecord: { kind: occurrence.sourceRecordKind, id: occurrence.sourceRecordId },
      sourceOccurrence: { kind: occurrence.sourceOccurrenceKind, id: occurrence.sourceOccurrenceId },
      occurredAt: occurrence.occurredAt,
      expiresAt: occurrence.expiresAt,
      readAt: readTimes.get(String(occurrence.id)) ?? null,
      ...(occurrence.outcome ? { outcome: occurrence.outcome } : {}),
    })
    if (!parsed.success) throw new ClinicNotificationError('CONTRACT_INCOMPATIBLE')
    const member = parsed.data
    const projection = await readNotificationSourceProjection(req, member)
    if (!projection.visible) continue
    items.push({
      kind: 'occurrence',
      presentationId: member.notificationId,
      display: {
        eventLabel: labels[member.eventType],
        ...('displayName' in projection && projection.displayName ? { displayName: projection.displayName } : {}),
        ...('outcome' in member ? { outcome: member.outcome } : {}),
        ...('rating' in projection && typeof projection.rating === 'number' ? { rating: projection.rating } : {}),
      },
      destination:
        member.sourceRecord.kind === 'inquiry'
          ? { kind: 'inquiry', inquiryId: member.sourceRecord.id }
          : { kind: 'review', reviewId: member.sourceRecord.id },
      members: [member],
    })
  }
  const compareMembers = (left: NotificationMember, right: NotificationMember) =>
    left.occurredAt.localeCompare(right.occurredAt) ||
    left.sourceOccurrence.id.localeCompare(right.sourceOccurrence.id, 'en', { numeric: true }) ||
    left.notificationId.localeCompare(right.notificationId)
  const groups = new Map<string, NotificationItem>()
  const grouped: NotificationItem[] = []
  for (const item of items) {
    const member = item.members[0]!
    if (member.eventType !== 'patient_message_received' || member.readAt !== null) {
      if (member.eventType === 'patient_message_received') item.destination = messageDestination(member)
      grouped.push(item)
      continue
    }
    const inquiryId = member.sourceRecord.id
    let group = groups.get(inquiryId)
    if (!group) {
      group = {
        ...item,
        kind: 'patient_message_group',
        presentationId: `patient-messages:${createHash('sha256').update(inquiryId).digest('hex')}`,
        members: [],
      }
      groups.set(inquiryId, group)
      grouped.push(group)
    }
    group.members.push(member)
  }
  for (const group of groups.values()) {
    group.members.sort(compareMembers)
    const oldest = group.members[0]!
    group.destination = messageDestination(oldest)
    group.display = {
      ...group.display,
      eventLabel: group.members.length === 1 ? '1 new message' : `${group.members.length} new messages`,
    }
  }
  grouped.sort(
    (left, right) =>
      compareMembers(right.members.at(-1)!, left.members.at(-1)!) ||
      right.presentationId.localeCompare(left.presentationId),
  )
  const unread = grouped.filter((item) => item.members[0]!.readAt === null)
  const summary = {
    unreadCount: unread.length,
    nextUnreadCountChangeAt:
      unread
        .map((item) =>
          item.members
            .map((member) => member.expiresAt)
            .sort()
            .at(-1)!,
        )
        .sort()[0] ?? null,
  }
  const envelope = { contractVersion: CLINIC_NOTIFICATIONS_CONTRACT_VERSION, serverTime }
  if (input.mode === 'summary') return notificationsResponseSchema.parse({ ...envelope, mode: 'summary', ...summary })
  const eligible = input.view === 'unread' ? unread : grouped
  const selected: NotificationItem[] = []
  const body = () => ({
    ...envelope,
    mode: 'page' as const,
    view: input.view,
    ...summary,
    items: selected,
    nextCursor:
      selected.length < eligible.length
        ? Buffer.from(
            JSON.stringify({
              contractVersion: CLINIC_NOTIFICATIONS_CONTRACT_VERSION,
              clinic: String(access.clinic.id),
              principal: String(access.staff.id),
              view: input.view,
              last: selected.at(-1)?.presentationId,
            }),
          ).toString('base64url')
        : null,
  })
  for (const item of eligible) {
    if (Buffer.byteLength(JSON.stringify({ ...body(), items: [item], nextCursor: null })) > NOTIFICATION_PAGE_MAX_BYTES)
      throw new ClinicNotificationError('PAYLOAD_TOO_LARGE')
  }
  for (const item of eligible) {
    if (selected.length === NOTIFICATION_PAGE_MAX_ENTRIES) break
    selected.push(item)
    if (Buffer.byteLength(JSON.stringify(body())) > NOTIFICATION_PAGE_MAX_BYTES) {
      selected.pop()
      if (!selected.length) throw new ClinicNotificationError('PAYLOAD_TOO_LARGE')
      break
    }
  }
  return notificationsResponseSchema.parse(body())
}

export { markClinicNotificationsRead } from './markRead'
