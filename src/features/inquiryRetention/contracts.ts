import { z } from 'zod'

import { inquiryIdSchema } from '@/features/inquiryCommunication/contracts'

export const inquiryRetentionCutoverInputSchema = z
  .object({ limit: z.number().int().min(1).max(100).default(50) })
  .strict()

export const inquiryRetentionReviewQueueInputSchema = z
  .object({
    cursor: z
      .string()
      .min(1)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/u)
      .optional(),
    limit: z.number().int().min(1).max(100).default(50),
    now: z.string().datetime({ offset: true }).optional(),
  })
  .strict()

export const inquiryPendingDeleteRecoveryInputSchema = z
  .object({
    cursor: z
      .string()
      .min(1)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/u)
      .optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict()

export const inquiryLegalHoldPlaceInputSchema = z
  .object({
    reasonCategory: z.enum(['legal-request', 'regulatory-review', 'litigation', 'other-authorized']),
    responsibleFunction: z.enum(['legal', 'data-protection']),
    reviewAt: z.string().datetime({ offset: true }),
    targetId: inquiryIdSchema,
    targetType: z.enum(['inquiry', 'moderation-case']),
  })
  .strict()

export const inquiryLegalHoldReleaseInputSchema = z.object({ holdId: inquiryIdSchema }).strict()

export const inquiryDeletionInputSchema = z
  .object({
    inquiryId: inquiryIdSchema,
    reasonCategory: z.enum(['authorized-erasure', 'retention-review']),
  })
  .strict()

export const inquiryContentHardDeleteInputSchema = z
  .object({
    inquiryId: inquiryIdSchema,
    reasonCategory: z.enum(['authorized-erasure', 'retention-review']),
    targetId: inquiryIdSchema,
    targetType: z.enum(['attachment', 'message']),
  })
  .strict()

export type InquiryRetentionReviewItemDTO = {
  id: string
  policyVersion: string
  reviewDueAt: string
  targetType: 'inquiry' | 'moderation-case'
}

export type InquiryRetentionReviewQueueDTO = {
  items: InquiryRetentionReviewItemDTO[]
  nextCursor?: string
}
