import { z } from 'zod'

export const clinicReviewDetailIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u)
export const clinicReviewDetailSchema = z
  .object({
    id: clinicReviewDetailIdSchema,
    reviewDate: z.string().datetime({ offset: true }),
    starRating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    status: z.literal('approved'),
    treatment: z.object({ id: clinicReviewDetailIdSchema, name: z.string().trim().min(1).max(200) }).strict(),
    publicMeasure: z.enum(['none', 'context', 'redaction', 'placeholder', 'removed']),
    withdrawalState: z.enum(['active', 'withdrawn']),
    withdrawnAt: z.string().datetime({ offset: true }).optional(),
    publicAuthorName: z.string().trim().min(1).max(200).optional(),
    comment: z.string().trim().min(1).max(10000).optional(),
    publicComment: z.string().trim().min(1).max(10000).optional(),
    publicNotice: z.string().trim().min(1).max(10000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const hidden = value.publicMeasure === 'removed' || value.withdrawalState === 'withdrawn'
    if (
      hidden &&
      [value.comment, value.publicComment, value.publicNotice, value.publicAuthorName].some(
        (value) => value !== undefined,
      )
    ) {
      context.addIssue({ code: 'custom', message: 'Unavailable public review details must remain withheld.' })
    }
    if (value.publicMeasure === 'redaction' && value.comment !== undefined) {
      context.addIssue({ code: 'custom', message: 'Original text is withheld after redaction.' })
    }
    if (value.publicMeasure === 'placeholder' && (value.comment !== undefined || value.publicComment !== undefined)) {
      context.addIssue({ code: 'custom', message: 'Placeholder reviews contain no written text.' })
    }
  })

export type ClinicReviewDetail = z.infer<typeof clinicReviewDetailSchema>
