import { z } from 'zod'

import { inquiryIdempotencyKeySchema, inquiryIdSchema } from '@/features/inquiryAggregate/contracts'

export type InquiryModerationAppealDTO = { caseId: string; state: 'available' | 'submitted' | 'unavailable' }

export type InquiryContentModerationDTO = {
  appeal?: InquiryModerationAppealDTO
  category?: string
  effectiveUntil?: string
  isCurrentActorAffected: boolean
}

export type InquiryModerationDTO = {
  conversation:
    | { state: 'available' }
    | (InquiryContentModerationDTO & {
        state: 'restricted'
      })
  identity:
    | { state: 'available' }
    | {
        appeal: InquiryModerationAppealDTO
        category?: string
        effectiveUntil?: string
        isCurrentActorAffected: true
        state: 'messaging-suspended'
      }
}

export const inquiryModerationReportCategorySchema = z.enum([
  'harassment-threats',
  'spam-fraud-impersonation',
  'suspected-illegal-content',
  'privacy-concern',
  'other',
])

export type InquiryModerationReportCategory = z.infer<typeof inquiryModerationReportCategorySchema>

export const inquiryModerationReportInputSchema = z
  .object({
    category: inquiryModerationReportCategorySchema,
    description: z.string().max(1_000).optional(),
    idempotencyKey: inquiryIdempotencyKeySchema,
    inquiryId: inquiryIdSchema,
    targetId: inquiryIdSchema,
    targetType: z.enum(['attachment', 'conversation', 'message']),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.category === 'other' && !value.description?.trim()) {
      context.addIssue({ code: 'custom', message: 'A short description is required for Other.' })
    }
  })

export type InquiryModerationReportInput = z.infer<typeof inquiryModerationReportInputSchema>

export type InquiryModerationReportReceiptDTO = {
  received: true
  reportId: string
}

export const inquiryModerationCaseReadInputSchema = z
  .object({
    caseId: inquiryIdSchema,
    scope: z.enum(['reported-object', 'full-conversation']),
  })
  .strict()

export const inquiryModerationAccessExpandInputSchema = z
  .object({
    caseId: inquiryIdSchema,
    reason: z.string().trim().min(1).max(500),
  })
  .strict()

const affectedActorSchema = z.discriminatedUnion('kind', [
  z.object({ id: inquiryIdSchema, kind: z.literal('patient') }).strict(),
  z.object({ id: inquiryIdSchema, kind: z.literal('clinic') }).strict(),
])

export const inquiryModerationDecisionInputSchema = z
  .object({
    affectedActor: affectedActorSchema.optional(),
    caseId: inquiryIdSchema,
    category: inquiryModerationReportCategorySchema,
    effectiveUntil: z.string().datetime({ offset: true }).optional(),
    outcome: z.enum(['no-action', 'content-restricted', 'conversation-restricted', 'identity-messaging-suspended']),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.outcome === 'conversation-restricted' || value.outcome === 'identity-messaging-suspended') &&
      !value.affectedActor
    ) {
      context.addIssue({ code: 'custom', message: 'The affected participant is required for this measure.' })
    }
    if ((value.outcome === 'no-action' || value.outcome === 'content-restricted') && value.affectedActor) {
      context.addIssue({ code: 'custom', message: 'This outcome derives its affected participant.' })
    }
  })

export type InquiryModerationCaseReadInput = z.infer<typeof inquiryModerationCaseReadInputSchema>
export type InquiryModerationAccessExpandInput = z.infer<typeof inquiryModerationAccessExpandInputSchema>
export type InquiryModerationDecisionInput = z.infer<typeof inquiryModerationDecisionInputSchema>

export const inquiryModerationAppealInputSchema = z
  .object({
    caseId: inquiryIdSchema,
    text: z
      .string()
      .max(1_000)
      .superRefine((value, context) => {
        if (!value.trim()) context.addIssue({ code: 'custom', message: 'An appeal needs text.' })
      }),
  })
  .strict()

export const inquiryModerationAppealDecisionInputSchema = z
  .object({
    caseId: inquiryIdSchema,
    outcome: z.enum(['upheld', 'overturned']),
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict()

export type InquiryModerationAppealInput = z.infer<typeof inquiryModerationAppealInputSchema>
export type InquiryModerationAppealDecisionInput = z.infer<typeof inquiryModerationAppealDecisionInputSchema>

export type InquiryModerationCaseDTO = {
  caseId: string
  category: z.infer<typeof inquiryModerationReportCategorySchema>
  context: Array<{ actorKind: 'clinic' | 'patient'; createdAt: string; id: string }>
  conversation?: Array<{
    actorKind: 'clinic' | 'patient'
    attachment?: { fileName: string; id: string; mimeType: string; sizeBytes: number }
    attachmentState?: 'available' | 'hard-deleted'
    contentState: 'available' | 'hard-deleted'
    createdAt: string
    id: string
    text?: string
  }>
  description?: string
  target: {
    attachment?: { fileName: string; id: string; mimeType: string; sizeBytes: number }
    attachmentState?: 'available' | 'hard-deleted'
    contentState: 'available' | 'hard-deleted'
    createdAt: string
    id: string
    text?: string
    type: 'attachment' | 'conversation' | 'message'
  }
}
