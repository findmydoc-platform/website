import { z } from 'zod'

import { verifiedInquiryCreateInputSchema } from './contracts'

const discardLegacySession = (body: unknown): unknown => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return body
  // Existing open tabs can still send this retired field during the coordinated rollout.
  return Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'session_id'))
}

export const verifiedInquiryCreateRequestSchema = z.preprocess(discardLegacySession, verifiedInquiryCreateInputSchema)
