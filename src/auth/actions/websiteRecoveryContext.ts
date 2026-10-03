import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import type { NextResponse } from 'next/server'
import { authActionEnvironments } from './contracts'
import type { RecoveryKey } from './recoveryContext'

export const WEBSITE_RECOVERY_COOKIE = 'findmydoc_website_recovery'
export const recoveryFinish = {
  'patient-recovery': '/login/patient?status=recovery-complete',
  'platform-recovery': '/admin/login?status=recovery-complete',
} as const
const lifetime = 600000
const schema = z
  .object({
    actionId: z.number().int().positive(),
    environment: z.enum(authActionEnvironments),
    subject: z.string().uuid(),
    flow: z.enum(['patient-recovery', 'platform-recovery']),
    destination: z.enum(['/login/patient?status=recovery-complete', '/admin/login?status=recovery-complete']),
    csrf: z.string().regex(/^[a-f0-9]{64}$/),
    issuedAt: z.number().int(),
    expiresAt: z.number().int(),
    stage: z.enum(['pending', 'confirmed', 'password-updated', 'completed', 'signed-out']),
    tokenHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict()
export type WebsiteRecoveryContext = z.infer<typeof schema>
function signature(value: string, secret: string) {
  return createHmac('sha256', secret).update(`website-recovery-context-v1|${value}`).digest()
}
function encryptionKey(secret: string) {
  return createHmac('sha256', secret).update('website-recovery-encryption-key-v1').digest()
}
export function readWebsiteRecoveryContext(
  value: string | undefined,
  environment: WebsiteRecoveryContext['environment'],
  keys: readonly RecoveryKey[],
  now = Date.now(),
): WebsiteRecoveryContext | null {
  if (!value || value.length > 3500) return null
  try {
    const parts = value.split('.')
    if (parts.length !== 3) return null
    const [version, payload, mac] = parts as [string, string, string]
    const key = keys.find((key) => key.version === version)
    if (
      !key ||
      !/^[a-f0-9]{64}$/.test(mac) ||
      !timingSafeEqual(signature(`${version}.${payload}`, key.secret), Buffer.from(mac, 'hex'))
    )
      return null
    const encrypted = Buffer.from(payload, 'base64url')
    if (encrypted.length !== 1052) return null
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(key.secret), encrypted.subarray(0, 12))
    decipher.setAuthTag(encrypted.subarray(12, 28))
    const parsed = schema.parse(
      JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]).toString('utf8')),
    )
    if (
      parsed.environment !== environment ||
      parsed.destination !== recoveryFinish[parsed.flow] ||
      parsed.issuedAt > now ||
      parsed.expiresAt <= now ||
      parsed.expiresAt !== parsed.issuedAt + lifetime ||
      (parsed.stage === 'pending' ? !parsed.tokenHash : parsed.tokenHash !== undefined)
    )
      return null
    return parsed
  } catch {
    return null
  }
}
export function pendingWebsiteRecovery(
  actionId: number,
  subject: string,
  flow: WebsiteRecoveryContext['flow'],
  environment: WebsiteRecoveryContext['environment'],
  tokenHash: string,
): WebsiteRecoveryContext {
  const issuedAt = Date.now()
  return schema.parse({
    actionId,
    subject,
    flow,
    environment,
    tokenHash,
    issuedAt,
    expiresAt: issuedAt + lifetime,
    destination: recoveryFinish[flow],
    csrf: randomBytes(32).toString('hex'),
    stage: 'pending',
  })
}
export function confirmedWebsiteRecovery(context: WebsiteRecoveryContext): WebsiteRecoveryContext {
  const { tokenHash: _token, ...grant } = context
  const issuedAt = Date.now()
  return { ...grant, issuedAt, expiresAt: issuedAt + lifetime, stage: 'confirmed' }
}
export function setWebsiteRecoveryContext(
  response: NextResponse,
  context: WebsiteRecoveryContext,
  keys: readonly RecoveryKey[],
) {
  const key = keys[0]!
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key.secret), nonce)
  // Fixed-size ciphertext conceals action IDs, principal variant and pending/decoy differences.
  const plaintext = JSON.stringify(schema.parse(context)).padEnd(1024, ' ')
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const payload = Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64url')
  const value = `${key.version}.${payload}`
  response.cookies.set(WEBSITE_RECOVERY_COOKIE, `${value}.${signature(value, key.secret).toString('hex')}`, {
    httpOnly: true,
    path: '/auth',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.max(0, Math.floor((context.expiresAt - Date.now()) / 1000)),
  })
}
export function clearWebsiteRecoveryContext(response: NextResponse) {
  response.cookies.set(WEBSITE_RECOVERY_COOKIE, '', {
    httpOnly: true,
    path: '/auth',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  })
}
