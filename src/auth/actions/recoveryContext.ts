import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import { z } from 'zod'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import { authActionEnvironments } from './contracts'

type Environment = (typeof authActionEnvironments)[number]
export type RecoveryKey = { version: string; secret: string }
declare const trustedClient: unique symbol
export type RecoveryContext = { readonly [trustedClient]: true }
type Client = { environment: Environment; ip: string; email?: string; expiresAt?: number }

const contextKey = Symbol.for('findmydoc.recovery-client-context.v1')
const clients: WeakMap<object, Client> = (() => {
  const existing = Reflect.get(globalThis, contextKey)
  if (existing) return existing as WeakMap<object, Client>
  const map = new WeakMap<object, Client>()
  Object.defineProperty(globalThis, contextKey, { value: map, writable: false, configurable: false })
  return map
})()

export function canonicalRecoveryIP(value: string): string | null {
  const ip = value.trim()
  if (!isIP(ip) || ip.includes('%')) return null
  if (isIP(ip) === 4) return ip
  const normalized = new URL(`http://[${ip}]`).hostname.slice(1, -1)
  const mapped = /^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/.exec(normalized)
  if (!mapped) return normalized
  const upper = parseInt(mapped[1]!, 16)
  const lower = parseInt(mapped[2]!, 16)
  return `${upper >> 8}.${upper & 255}.${lower >> 8}.${lower & 255}`
}

function remember(client: Client): RecoveryContext {
  const identity = Object.freeze({}) as RecoveryContext
  clients.set(identity, client)
  return identity
}

/** Internal Auth admission only. Plain objects and serialized contexts are not trusted. */
export function inspectRecoveryContext(context: unknown, environment: Environment, email: string, now: number) {
  if (!context || typeof context !== 'object') return null
  const client = clients.get(context)
  if (
    !client ||
    client.environment !== environment ||
    (client.email && client.email !== email) ||
    (client.expiresAt != null && now >= client.expiresAt)
  )
    return null
  return client.ip
}

/** Only the Vercel-controlled header is accepted; there is no local or proxy-header fallback. */
export function websiteRecoveryContext(request: Request): RecoveryContext | null {
  const environment = process.env.VERCEL_ENV
  if (process.env.VERCEL !== '1' || (environment !== 'preview' && environment !== 'production')) return null
  const ip = canonicalRecoveryIP(request.headers.get('x-vercel-forwarded-for') ?? '')
  return ip ? remember({ environment, ip }) : null
}

export function validatedRecoveryKeys(keys: readonly RecoveryKey[]): RecoveryKey[] | null {
  const ring = z
    .array(
      z
        .object({
          version: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
          secret: z.string().min(32),
        })
        .strict(),
    )
    .min(1)
    .safeParse(keys)
  if (!ring.success || new Set(ring.data.map((key) => key.version)).size !== ring.data.length) return null
  return ring.data
}

/** Authentication primitive for the future Dashboard requestRecovery adapter, not an HTTP endpoint. */
export function dashboardRecoveryContext(
  input: {
    method: string
    operation: string
    timestamp: string
    requestId: string
    body: string
    keyVersion: string
    signature: string
  },
  options: {
    environment: Environment
    keys: readonly RecoveryKey[]
    now?: () => number
    protocolVersion?: 1
  },
): RecoveryContext | null {
  try {
    const keys = validatedRecoveryKeys(options.keys)
    const key = keys?.find((key) => key.version === input.keyVersion)
    const now = (options.now ?? Date.now)()
    const timestamp = Date.parse(input.timestamp)
    if (
      !key ||
      !authActionEnvironments.includes(options.environment) ||
      !Number.isFinite(now) ||
      !Number.isFinite(timestamp) ||
      timestamp > now ||
      now - timestamp >= 300000 ||
      input.method !== 'POST' ||
      input.operation !== 'requestRecovery' ||
      !z.string().uuid().safeParse(input.requestId).success ||
      input.body.length > 4096 ||
      !/^[a-f0-9]{64}$/.test(input.signature)
    )
      return null
    const expected = createHmac('sha256', key.secret)
      .update(
        JSON.stringify([
          options.protocolVersion === 1 ? 'auth-action-protocol-v1' : 'auth-recovery-request-v1',
          options.environment,
          input.method,
          input.operation,
          input.timestamp,
          input.requestId,
          createHash('sha256').update(input.body, 'utf8').digest('hex'),
        ]),
        'utf8',
      )
      .digest()
    if (!timingSafeEqual(expected, Buffer.from(input.signature, 'hex'))) return null
    const body = z
      .object({ email: z.string().max(254), clientIP: z.string().max(64) })
      .strict()
      .safeParse(JSON.parse(input.body))
    if (!body.success) return null
    const email = normalizeEmail(body.data.email)
    const ip = canonicalRecoveryIP(body.data.clientIP)
    if (!isValidEmail(email) || !ip) return null
    return remember({ environment: options.environment, ip, email, expiresAt: timestamp + 300000 })
  } catch {
    return null
  }
}
