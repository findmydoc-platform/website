import { z } from 'zod'

export const inquiryIdSchema = z.string().trim().min(1).max(100)
export const inquiryIdempotencyKeySchema = z.string().trim().min(8).max(200)
