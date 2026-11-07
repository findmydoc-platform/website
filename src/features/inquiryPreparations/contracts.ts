import { z } from 'zod'
import { verifiedInquiryCreateInputSchema } from '@/features/inquiryCommunication/contracts'

export const preparationInputSchema = verifiedInquiryCreateInputSchema.safeExtend({
  firstName: z.string().trim().min(1).max(200),
  lastName: z.string().trim().min(1).max(200),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  phoneNumber: z.string().trim().min(1).max(80),
  accountAuthorization: z.literal(true),
})
export type PreparationInput = z.infer<typeof preparationInputSchema>
export type PreparationReceipt = {
  reference: string
  authorizedAt: string
  expiresAt: string
  status: 'saved-not-sent' | 'sign-in-required' | 'try-again' | 'submitted'
  clinicName?: string
  inquiryId?: string
  firstAttemptAt?: string
}
