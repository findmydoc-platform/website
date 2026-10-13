import { z } from 'zod'

export const CLINIC_NOTIFICATIONS_CONTRACT_VERSION = 'clinic-notifications-v1'
export const CLINIC_NOTIFICATIONS_CONTRACT_HEADER = 'X-Findmydoc-Clinic-Notifications-Contract'
export const CLINIC_NOTIFICATIONS_SUPPORT_HEADER = 'X-Findmydoc-Clinic-Notifications-Support'
export const NOTIFICATION_PAGE_MAX_BYTES = 524_288
export const NOTIFICATION_READ_MAX_BYTES = 4 * 1024 * 1024
export const NOTIFICATION_PAGE_MAX_ENTRIES = 25
export const NOTIFICATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

const id = z.string().min(1).max(200)
const timestamp = z.iso.datetime({ precision: 3 })
const inquiryRecord = z.object({ kind: z.literal('inquiry'), id }).strict()
const reviewRecord = z.object({ kind: z.literal('review'), id }).strict()
const source = <Kind extends string>(kind: Kind) => z.object({ kind: z.literal(kind), id }).strict()
const member = z
  .object({
    notificationId: id,
    schemaVersion: z.literal(1),
    occurredAt: timestamp,
    expiresAt: timestamp,
    readAt: timestamp.nullable(),
  })
  .strict()

export const notificationMemberSchema = z
  .discriminatedUnion('eventType', [
    member.extend({
      eventType: z.literal('inquiry_created'),
      sourceRecord: inquiryRecord,
      sourceOccurrence: source('inquiry_audit'),
    }),
    member.extend({
      eventType: z.literal('patient_message_received'),
      sourceRecord: inquiryRecord,
      sourceOccurrence: source('patient_message'),
    }),
    member.extend({
      eventType: z.literal('review_published'),
      sourceRecord: reviewRecord,
      sourceOccurrence: source('review_transition'),
    }),
    member.extend({
      eventType: z.literal('clinic_response_decided'),
      sourceRecord: reviewRecord,
      sourceOccurrence: source('response_decision'),
      outcome: z.enum(['approved', 'rejected', 'blocked']),
    }),
    member.extend({
      eventType: z.literal('review_appeal_decided'),
      sourceRecord: reviewRecord,
      sourceOccurrence: source('review_appeal_decision'),
      outcome: z.enum(['upheld', 'rejected']),
    }),
    member.extend({
      eventType: z.literal('inquiry_restricted'),
      sourceRecord: inquiryRecord,
      sourceOccurrence: source('inquiry_moderation_event'),
    }),
    member.extend({
      eventType: z.literal('inquiry_restored'),
      sourceRecord: inquiryRecord,
      sourceOccurrence: source('inquiry_moderation_event'),
    }),
    member.extend({
      eventType: z.literal('inquiry_appeal_decided'),
      sourceRecord: inquiryRecord,
      sourceOccurrence: source('inquiry_moderation_event'),
      outcome: z.enum(['confirmed', 'lifted']),
    }),
    member.extend({
      eventType: z.literal('review_withdrawn'),
      sourceRecord: reviewRecord,
      sourceOccurrence: source('review_transition'),
    }),
    member.extend({
      eventType: z.literal('review_removed'),
      sourceRecord: reviewRecord,
      sourceOccurrence: source('review_transition'),
    }),
  ])
  .superRefine((value, context) => {
    if (Date.parse(value.expiresAt) !== Date.parse(value.occurredAt) + NOTIFICATION_RETENTION_MS) {
      context.addIssue({ code: 'custom', message: 'Occurrence expiry must preserve the original ninety-day deadline.' })
    }
  })

export const notificationDestinationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('inquiry'),
      inquiryId: id,
      anchor: z.discriminatedUnion('kind', [source('message'), source('appeal'), source('occurrence')]).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('review'),
      reviewId: id,
      anchor: z.discriminatedUnion('kind', [source('response'), source('appeal'), source('occurrence')]).optional(),
    })
    .strict(),
])

const display = z
  .object({
    eventLabel: z.string().min(1).max(200),
    displayName: z.string().min(1).max(200).optional(),
    rating: z.number().int().min(1).max(5).optional(),
    outcome: z.enum(['approved', 'rejected', 'blocked', 'upheld', 'confirmed', 'lifted']).optional(),
  })
  .strict()

export const notificationItemSchema = z
  .discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('occurrence'),
        presentationId: id,
        display,
        destination: notificationDestinationSchema,
        members: z.array(notificationMemberSchema).length(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal('patient_message_group'),
        presentationId: id,
        display,
        destination: notificationDestinationSchema,
        members: z.array(notificationMemberSchema).min(1),
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    const destinationId =
      value.destination.kind === 'inquiry' ? value.destination.inquiryId : value.destination.reviewId
    const seen = new Set<string>()
    for (const occurrence of value.members) {
      if (
        seen.has(occurrence.notificationId) ||
        occurrence.sourceRecord.kind !== value.destination.kind ||
        occurrence.sourceRecord.id !== destinationId ||
        (value.kind === 'patient_message_group' &&
          (occurrence.eventType !== 'patient_message_received' || occurrence.readAt !== null))
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Complete membership must agree with its exact destination and personal grouping.',
        })
      }
      seen.add(occurrence.notificationId)
    }
  })

const summaryFields = { unreadCount: z.number().int().nonnegative(), nextUnreadCountChangeAt: timestamp.nullable() }
const envelope = { contractVersion: z.literal(CLINIC_NOTIFICATIONS_CONTRACT_VERSION), serverTime: timestamp }
const pageFields = {
  ...envelope,
  mode: z.literal('page'),
  view: z.enum(['unread', 'all']),
  items: z.array(notificationItemSchema).max(NOTIFICATION_PAGE_MAX_ENTRIES),
  nextCursor: z.string().min(1).max(4096).nullable(),
}

export const notificationsResponseSchema = z.union([
  z.object({ ...envelope, mode: z.literal('summary'), ...summaryFields }).strict(),
  z.object({ ...pageFields, ...summaryFields }).strict(),
  z.object(pageFields).strict(),
])
export const notificationReadInputSchema = z.object({ notificationIds: z.array(id) }).strict()
export const notificationReadSuccessSchema = z.object({ ...envelope, acknowledged: z.literal(true) }).strict()
export const notificationErrorCodes = [
  'UNAUTHENTICATED',
  'CLINIC_ACCESS_DENIED',
  'CONTENT_ACCESS_DENIED',
  'INVALID_INPUT',
  'REQUEST_REJECTED',
  'TARGET_UNAVAILABLE',
  'CURSOR_INVALID',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'SERVICE_TIMEOUT',
  'CONTRACT_INCOMPATIBLE',
  'PAYLOAD_TOO_LARGE',
] as const
export const notificationErrorSchema = z
  .object({
    contractVersion: z.literal(CLINIC_NOTIFICATIONS_CONTRACT_VERSION),
    error: z.object({ code: z.enum(notificationErrorCodes) }).strict(),
    writeOutcome: z.enum(['not_committed', 'unknown']).optional(),
  })
  .strict()
export const notificationReadQuerySchema = z.union([
  z.object({ mode: z.literal('summary') }).strict(),
  z
    .object({
      mode: z.literal('page'),
      view: z.enum(['unread', 'all']),
      cursor: z.string().min(1).max(4096).optional(),
    })
    .strict(),
])

export type NotificationMember = z.infer<typeof notificationMemberSchema>
export type NotificationItem = z.infer<typeof notificationItemSchema>
export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>
export type NotificationReadQuery = z.infer<typeof notificationReadQuerySchema>
export type NotificationErrorCode = (typeof notificationErrorCodes)[number]
