import { z } from 'zod'

export const INQUIRY_TEXT_MAX_LENGTH = 3_000
export const INQUIRY_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024
export const INQUIRY_ATTACHMENT_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] as const

export const inquiryHandlingStatusSchema = z.enum(['submitted', 'in_review', 'contacted', 'spam'])
export const inquiryLifecycleSchema = z.enum(['open', 'closed'])

export const clinicHandlingStatusTransitions = {
  submitted: ['in_review', 'contacted'],
  in_review: ['contacted'],
  contacted: ['in_review'],
  spam: [],
} as const satisfies Record<z.infer<typeof inquiryHandlingStatusSchema>, readonly string[]>

export const isAllowedClinicHandlingStatusTransition = (
  from: z.infer<typeof inquiryHandlingStatusSchema>,
  to: 'contacted' | 'in_review' | 'submitted',
): boolean => clinicHandlingStatusTransitions[from].includes(to as never)
export const inquiryIdSchema = z.string().trim().min(1).max(100)
export const inquiryIdempotencyKeySchema = z.string().trim().min(8).max(200)
export const inquiryRevisionSchema = z.number().int().nonnegative()
export const inquiryTextSchema = z.string().max(INQUIRY_TEXT_MAX_LENGTH)
const nonBlankInquiryTextSchema = inquiryTextSchema.superRefine((value, context) => {
  if (!value.trim()) context.addIssue({ code: 'custom', message: 'Text cannot be empty.' })
})

const optionalIdentifierSchema = inquiryIdSchema.optional()

const numericRelationIdSchema = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim()) return Number(value)
  return value
}, z.number().int().positive())

const optionalNumericRelationIdSchema = z.preprocess((value) => {
  if (value === null || typeof value === 'undefined' || value === '') return undefined
  if (typeof value === 'string' && value.trim()) return Number(value)
  return value
}, z.number().int().positive().optional())

const guestMessageSchema = inquiryTextSchema.superRefine((value, context) => {
  if (!value.trim()) context.addIssue({ code: 'custom', message: 'Message is required.' })
})

export const guestInquiryCreateInputSchema = z
  .object({
    clinicId: numericRelationIdSchema,
    consent: z.boolean().refine(Boolean, { message: 'Consent is required.' }),
    doctorId: optionalNumericRelationIdSchema,
    email: z
      .string()
      .trim()
      .email('Email is invalid.')
      .max(254)
      .transform((value) => value.toLowerCase()),
    fullName: z.string().trim().min(1, 'Full name is required.').max(200),
    message: guestMessageSchema,
    phoneNumber: z.string().trim().min(1, 'Phone number is required.').max(80),
    preferredContactWindow: z
      .enum(['as_soon_as_possible', 'morning', 'afternoon', 'evening', 'no_preference'])
      .optional(),
    treatmentId: optionalNumericRelationIdSchema,
    treatmentTimeline: z.enum(['as_soon_as_possible', 'within_two_weeks', 'within_one_month', 'flexible']).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.doctorId && !value.treatmentId) {
      context.addIssue({ code: 'custom', message: 'Select a doctor or treatment.' })
    }
  })

export const legacyInquiryStatusSchema = z.enum(['submitted', 'in_review', 'contacted', 'closed', 'spam'])

export const legacyInquiryStatusInputSchema = z
  .object({
    status: legacyInquiryStatusSchema,
  })
  .strict()

export const verifiedInquiryCreateInputSchema = z
  .object({
    clinicId: inquiryIdSchema,
    consent: z.literal(true),
    doctorId: optionalIdentifierSchema,
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    fullName: z.string().trim().min(1).max(200),
    idempotencyKey: inquiryIdempotencyKeySchema,
    message: nonBlankInquiryTextSchema,
    phoneNumber: z.string().trim().min(1).max(80),
    preferredContactWindow: z.string().trim().min(1).max(80).optional(),
    treatmentId: optionalIdentifierSchema,
    treatmentTimeline: z.string().trim().min(1).max(80).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.doctorId && !value.treatmentId) {
      context.addIssue({ code: 'custom', message: 'Select a doctor or treatment.' })
    }
  })

export const clinicInquiryQueueInputSchema = z
  .object({
    cursor: z.string().trim().min(1).max(1_000).optional(),
    handlingStatus: z.array(inquiryHandlingStatusSchema).max(4).optional(),
    knownChangeCursor: z.string().trim().min(1).max(1_000).optional(),
    lifecycle: z.enum(['open', 'closed', 'all']).default('open'),
    limit: z.number().int().min(1).max(50).default(25),
    query: z.string().trim().max(200).optional(),
    unreadOnly: z.boolean().default(false),
  })
  .strict()

export const patientInquiryQueueInputSchema = z
  .object({
    cursor: z.string().trim().min(1).max(1_000).optional(),
    lifecycle: z.enum(['open', 'closed', 'all']).default('all'),
    limit: z.number().int().min(1).max(50).default(25),
  })
  .strict()

export const inquiryDetailInputSchema = z
  .object({
    inquiryId: inquiryIdSchema,
    knownChangeCursor: z.string().trim().min(1).max(1_000).optional(),
    knownRevision: inquiryRevisionSchema.optional(),
  })
  .strict()

export const externalMessageInputSchema = z
  .object({
    attachmentDraftId: inquiryIdSchema.optional(),
    expectedRevision: inquiryRevisionSchema,
    idempotencyKey: inquiryIdempotencyKeySchema,
    inquiryId: inquiryIdSchema,
    text: inquiryTextSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.text?.trim() && !value.attachmentDraftId) {
      context.addIssue({ code: 'custom', message: 'A message needs text or an attachment.' })
    }
  })

export const internalNoteInputSchema = z
  .object({
    idempotencyKey: inquiryIdempotencyKeySchema,
    inquiryId: inquiryIdSchema,
    text: inquiryTextSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.text.trim()) {
      context.addIssue({ code: 'custom', message: 'An internal note needs text.' })
    }
  })

export const inquiryStateInputSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('set-handling-status'),
      expectedRevision: inquiryRevisionSchema,
      handlingStatus: z.enum(['in_review', 'contacted']),
      inquiryId: inquiryIdSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('close'),
      expectedRevision: inquiryRevisionSchema,
      inquiryId: inquiryIdSchema,
      reason: z.string().trim().min(1).max(500).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('reopen'),
      expectedRevision: inquiryRevisionSchema,
      inquiryId: inquiryIdSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('mark-spam'),
      expectedRevision: inquiryRevisionSchema,
      inquiryId: inquiryIdSchema,
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      action: z.literal('remove-spam'),
      expectedRevision: inquiryRevisionSchema,
      inquiryId: inquiryIdSchema,
    })
    .strict(),
])

export const inquiryReadPositionInputSchema = z
  .object({
    activityId: inquiryIdSchema.optional(),
    inquiryId: inquiryIdSchema,
    mode: z.enum(['read', 'unread']),
  })
  .strict()

export const inquiryContactRevealInputSchema = z
  .object({
    inquiryId: inquiryIdSchema,
  })
  .strict()

export const attachmentDraftCreateInputSchema = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), 'File names cannot contain control characters.'),
    inquiryId: inquiryIdSchema,
    mimeType: z.enum(INQUIRY_ATTACHMENT_MIME_TYPES),
    sizeBytes: z.number().int().positive().max(INQUIRY_ATTACHMENT_MAX_BYTES),
  })
  .strict()

export const attachmentDraftMutationInputSchema = z
  .object({
    draftId: inquiryIdSchema,
    inquiryId: inquiryIdSchema,
  })
  .strict()

export type InquiryHandlingStatus = z.infer<typeof inquiryHandlingStatusSchema>
export type InquiryLifecycle = z.infer<typeof inquiryLifecycleSchema>
export type ClinicInquiryQueueInput = z.infer<typeof clinicInquiryQueueInputSchema>
export type PatientInquiryQueueInput = z.input<typeof patientInquiryQueueInputSchema>
export type VerifiedInquiryCreateInput = z.infer<typeof verifiedInquiryCreateInputSchema>
export type InquiryDetailInput = z.infer<typeof inquiryDetailInputSchema>
export type ExternalMessageInput = z.infer<typeof externalMessageInputSchema>
export type InternalNoteInput = z.infer<typeof internalNoteInputSchema>
export type InquiryStateInput = z.infer<typeof inquiryStateInputSchema>
export type InquiryReadPositionInput = z.infer<typeof inquiryReadPositionInputSchema>
export type InquiryContactRevealInput = z.infer<typeof inquiryContactRevealInputSchema>
export type AttachmentDraftCreateInput = z.infer<typeof attachmentDraftCreateInputSchema>
export type AttachmentDraftMutationInput = z.infer<typeof attachmentDraftMutationInputSchema>
export type GuestInquiryCreateInput = z.infer<typeof guestInquiryCreateInputSchema>
export type LegacyInquiryStatus = z.infer<typeof legacyInquiryStatusSchema>

export type LegacyPatientClinicInquiryDTO = {
  createdAt: string
  email: string
  fullName: string
  id: string
  message: string
  phoneNumber: string
  preferredContactWindow?: 'as_soon_as_possible' | 'morning' | 'afternoon' | 'evening' | 'no_preference' | null
  status: LegacyInquiryStatus
  treatment?: string | { id: string; name: string } | null
  treatmentTimeline?: 'as_soon_as_possible' | 'within_two_weeks' | 'within_one_month' | 'flexible' | null
  updatedAt: string
}

export type InquiryCommunicationErrorCode =
  | 'INQUIRY_INVALID_INPUT'
  | 'INQUIRY_UNAUTHORIZED'
  | 'INQUIRY_ACCESS_DENIED'
  | 'INQUIRY_NOT_FOUND'
  | 'INQUIRY_CONFLICT'
  | 'INQUIRY_INVALID_STATE'
  | 'INQUIRY_PAYLOAD_TOO_LARGE'
  | 'INQUIRY_UNSUPPORTED_MEDIA_TYPE'
  | 'INQUIRY_RATE_LIMITED'
  | 'INQUIRY_SERVICE_UNAVAILABLE'
  | 'INQUIRY_SERVICE_TIMEOUT'
  | 'INQUIRY_REAUTHENTICATION_REQUIRED'

export type InquiryUnreadDTO = {
  count: number
  isUnread: boolean
  lastReadActivityId?: string
}

export type InquiryBindingDTO =
  | { kind: 'guest'; canReply: false }
  | {
      kind: 'patient'
      canReply: boolean
      conversationId: string
      patient: { displayName: string; id: string }
    }

export type InquiryAttachmentDTO = {
  fileName: string
  id: string
  mimeType: (typeof INQUIRY_ATTACHMENT_MIME_TYPES)[number]
  sizeBytes: number
}

export type InquiryTimelineItemDTO =
  | {
      actor: { displayName: string; kind: 'patient' | 'clinic'; isCurrentActor: boolean }
      attachment?: InquiryAttachmentDTO
      createdAt: string
      id: string
      kind: 'external-message'
      text?: string
    }
  | {
      actor: { displayName: string; kind: 'clinic'; isCurrentActor: boolean }
      createdAt: string
      id: string
      kind: 'internal-note'
      text: string
    }
  | {
      actor: { displayName: string; kind: 'clinic' | 'system'; isCurrentActor: boolean }
      createdAt: string
      event: 'handling-status-changed' | 'closed' | 'reopened' | 'marked-spam' | 'spam-removed'
      id: string
      kind: 'system-event'
    }

export type InquiryListItemDTO = {
  binding: InquiryBindingDTO
  clinic: { displayName: string; id: string }
  createdAt: string
  handlingStatus: InquiryHandlingStatus
  id: string
  interest: {
    doctorId?: string
    label: string
    preferredContactWindow?: string
    treatmentId?: string
    treatmentTimeline?: string
  }
  latestActivityKind: 'inquiry' | 'external-message' | 'internal-note' | 'system-event'
  lastActivityAt: string
  lifecycle: InquiryLifecycle
  patientName: string
  preview: string
  revision: number
  unread: InquiryUnreadDTO
}

export type InquiryDetailDTO = InquiryListItemDTO & {
  actions: {
    canAddInternalNote: boolean
    canChangeHandlingStatus: boolean
    canChangeLifecycle: boolean
    canMarkRead: boolean
    canMarkUnread: boolean
    canReply: boolean
    canRevealContact: boolean
    canView: true
  }
  attachmentConstraints: {
    acceptedMimeTypes: readonly (typeof INQUIRY_ATTACHMENT_MIME_TYPES)[number][]
    maxFileBytes: number
    maxFilesPerMessage: 1
  }
  contact:
    | { email: string; mode: 'full'; phoneNumber: string }
    | { mode: 'collapsed' }
    | { email: string; mode: 'masked'; phoneNumber: string }
  originalRequest: {
    message: string
    preferredContactWindow?: string
    treatmentTimeline?: string
  }
  timeline: InquiryTimelineItemDTO[]
}

export type InquiryContactRevealDTO = {
  contact: { email: string; mode: 'full'; phoneNumber: string }
  inquiryId: string
}

export type InquiryAttachmentAccessDTO = {
  expiresAt: string
  method: 'GET'
  url: string
}

export type InquiryQueueDTO = {
  changeCursor: string
  items: InquiryListItemDTO[]
  nextCursor?: string
  unchanged: boolean
  unreadCount: number
}

export type PatientInquiryQueueDTO = InquiryQueueDTO & {
  counts: { all: number; closed: number; open: number }
}

export type InquiryDetailResultDTO = {
  changeCursor: string
  inquiry: InquiryDetailDTO
  unchanged: boolean
}

export type InquiryMutationResultDTO = {
  inquiry: InquiryDetailDTO
  replayed?: boolean
}

export type AttachmentDraftDTO = {
  draftId: string
  expiresAt: string
  upload: {
    headers: Record<string, string>
    method: 'PUT'
    url: string
  }
}

export type AttachmentFinalizeDTO = {
  attachment: InquiryAttachmentDTO
}
