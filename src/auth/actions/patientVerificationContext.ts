import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import type { NextResponse } from 'next/server'
import { authActionEnvironments } from './contracts'
import type { VerificationCorrelationKey } from './verificationCorrelation'

export const PATIENT_VERIFICATION_COOKIE = 'findmydoc_patient_verification'
const lifetime = 10 * 60 * 1000
const schema = z
  .object({
    actionId: z.number().int().positive(),
    environment: z.enum(authActionEnvironments),
    subject: z.string().uuid(),
    flow: z.literal('patient-verification'),
    destination: z.literal('/patient/inquiries'),
    csrf: z.string().regex(/^[a-f0-9]{64}$/),
    issuedAt: z.number().int(),
    expiresAt: z.number().int(),
    stage: z.enum(['pending', 'confirmed']),
    tokenHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict()
export type PatientVerificationContext = z.infer<typeof schema>

function signature(value: string, secret: string) {
  return createHmac('sha256', secret).update(`patient-verification-context-v1|${value}`).digest()
}
function encryptionKey(secret: string) {
  return createHmac('sha256', secret).update('patient-verification-encryption-key-v1').digest()
}

export function readPatientVerificationContext(
  value: string | undefined,
  environment: PatientVerificationContext['environment'],
  keys: readonly VerificationCorrelationKey[],
  now = Date.now(),
): PatientVerificationContext | null {
  if (!value || value.length > 3500) return null
  try {
    const parts = value.split('.')
    if (parts.length !== 3) return null
    const [version, payload, mac] = parts as [string, string, string]
    const key = keys.find((key) => key.version === version)
    if (!key || !/^[a-f0-9]{64}$/.test(mac)) return null
    if (!timingSafeEqual(signature(`${version}.${payload}`, key.secret), Buffer.from(mac, 'hex'))) return null
    const encrypted = Buffer.from(payload, 'base64url')
    if (encrypted.length <= 28) return null
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(key.secret), encrypted.subarray(0, 12))
    decipher.setAuthTag(encrypted.subarray(12, 28))
    const plaintext = Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()])
    const parsed = schema.parse(JSON.parse(plaintext.toString('utf8')))
    if (
      parsed.environment !== environment ||
      parsed.issuedAt > now ||
      parsed.expiresAt <= now ||
      (parsed.stage === 'pending'
        ? parsed.expiresAt !== parsed.issuedAt + lifetime
        : parsed.expiresAt > parsed.issuedAt + 24 * 60 * 60 * 1000) ||
      (parsed.stage === 'pending' ? !parsed.tokenHash : parsed.tokenHash !== undefined)
    )
      return null
    return parsed
  } catch {
    return null
  }
}

export function pendingPatientContext(
  actionId: number,
  subject: string,
  environment: PatientVerificationContext['environment'],
  tokenHash: string,
): PatientVerificationContext {
  const issuedAt = Date.now()
  return schema.parse({
    actionId,
    subject,
    environment,
    tokenHash,
    issuedAt,
    expiresAt: issuedAt + lifetime,
    flow: 'patient-verification',
    destination: '/patient/inquiries',
    csrf: randomBytes(32).toString('hex'),
    stage: 'pending',
  })
}

export function setPatientVerificationContext(
  response: NextResponse,
  context: PatientVerificationContext,
  keys: readonly VerificationCorrelationKey[],
) {
  const key = keys[0]!
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key.secret), nonce)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(schema.parse(context)), 'utf8'), cipher.final()])
  const payload = Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64url')
  const value = `${key.version}.${payload}`
  response.cookies.set(PATIENT_VERIFICATION_COOKIE, `${value}.${signature(value, key.secret).toString('hex')}`, {
    httpOnly: true,
    path: '/auth',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.max(0, Math.floor((context.expiresAt - Date.now()) / 1000)),
  })
}

export function clearPatientVerificationContext(response: NextResponse) {
  response.cookies.set(PATIENT_VERIFICATION_COOKIE, '', {
    httpOnly: true,
    path: '/auth',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  })
}
