import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import { authActionEnvironments } from './contracts'

export const verificationCorrelationWindowMs = 24 * 60 * 60 * 1000
export const verificationCooldownMs = 5 * 60 * 1000
export const verificationDailyLimit = 5

const keySchema = z.object({ version: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), secret: z.string().min(32) }).strict()
export type VerificationCorrelationKey = z.infer<typeof keySchema>

/** Current key first; retain every previous key until its last correlation window ends. */
export function verificationCorrelations(
  email: string,
  environment: (typeof authActionEnvironments)[number],
  keys: readonly VerificationCorrelationKey[],
) {
  const normalizedEmail = normalizeEmail(email)
  const ring = z.array(keySchema).min(1).safeParse(keys)
  if (
    !isValidEmail(normalizedEmail) ||
    normalizedEmail.length > 254 ||
    !ring.success ||
    new Set(ring.data.map(({ version }) => version)).size !== ring.data.length
  )
    throw new Error('Invalid verification correlation configuration or input.')
  const message = JSON.stringify(['auth-action-correlation-v1', environment, 'patient-verification', normalizedEmail])
  return ring.data.map(({ version, secret }) => ({
    correlationKeyVersion: version,
    correlationDigest: createHmac('sha256', secret).update(message, 'utf8').digest('hex'),
  }))
}
