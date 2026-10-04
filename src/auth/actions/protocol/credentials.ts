import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { authActionEnvironments } from '../contracts'
import { validatedRecoveryKeys, type RecoveryKey } from '../recoveryContext'

export const authActionProtocolVersion = 1
export const authActionProtocolOperations = [
  'requestRecovery',
  'validateAction',
  'confirmAction',
  'completeAction',
] as const
export const dashboardActionFlows = ['clinic-invitation', 'clinic-recovery'] as const
export const authActionRequestWindowMs = 300_000
export const authActionRequestBodyLimit = 16_384

export type AuthActionProtocolKeys = {
  environment: (typeof authActionEnvironments)[number]
  service: readonly RecoveryKey[]
  reference: readonly RecoveryKey[]
}
export type AuthActionRequestEnvelope = {
  method: string
  operation: string
  timestamp: string
  requestId: string
  body: string
  keyVersion: string
  signature: string
}
export type DashboardActionFlow = (typeof dashboardActionFlows)[number]

const referenceSchema = z
  .object({
    version: z.literal(authActionProtocolVersion),
    actionId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    flow: z.enum(dashboardActionFlows),
    environment: z.enum(authActionEnvironments),
  })
  .strict()
export type ActionReference = z.infer<typeof referenceSchema>

function equalSignature(expected: Buffer, signature: string) {
  return /^[a-f0-9]{64}$/.test(signature) && timingSafeEqual(expected, Buffer.from(signature, 'hex'))
}

/** Transport authentication grants no action or user authority. Request-ID storage is a separate boundary. */
export function authenticateAuthActionRequest(
  input: AuthActionRequestEnvelope,
  keys: AuthActionProtocolKeys,
  now: number,
) {
  const key = validatedRecoveryKeys(keys.service)?.find((key) => key.version === input.keyVersion)
  const timestamp = Date.parse(input.timestamp)
  if (
    !key ||
    !authActionEnvironments.includes(keys.environment) ||
    !Number.isFinite(now) ||
    !Number.isFinite(timestamp) ||
    !z.iso.datetime().safeParse(input.timestamp).success ||
    new Date(timestamp).toISOString() !== input.timestamp ||
    timestamp > now ||
    now - timestamp >= authActionRequestWindowMs ||
    input.method !== 'POST' ||
    !authActionProtocolOperations.includes(input.operation as never) ||
    !z.uuid().safeParse(input.requestId).success ||
    input.requestId !== input.requestId.toLowerCase() ||
    Buffer.byteLength(input.body, 'utf8') > authActionRequestBodyLimit
  )
    return null
  const expected = createHmac('sha256', key.secret)
    .update(
      JSON.stringify([
        'auth-action-protocol-v1',
        keys.environment,
        input.method,
        input.operation,
        input.timestamp,
        input.requestId,
        createHash('sha256').update(input.body, 'utf8').digest('hex'),
      ]),
      'utf8',
    )
    .digest()
  return equalSignature(expected, input.signature)
    ? { requestId: input.requestId, expiresAt: timestamp + authActionRequestWindowMs }
    : null
}

/** This signer stays in Website server code. Dashboard receives only the opaque reference. */
export function createActionReference(
  input: { actionId: number; flow: DashboardActionFlow },
  keys: AuthActionProtocolKeys,
): string {
  const key = validatedRecoveryKeys(keys.reference)?.[0]
  if (!key) throw new Error('Auth-action protocol configuration unavailable.')
  const reference = referenceSchema.parse({
    version: authActionProtocolVersion,
    ...input,
    environment: keys.environment,
  })
  const encoded = Buffer.from(JSON.stringify(reference), 'utf8').toString('base64url')
  const signature = createHmac('sha256', key.secret)
    .update(JSON.stringify(['auth-action-reference-v1', key.version, encoded]))
    .digest('hex')
  return `${key.version}.${encoded}.${signature}`
}

export function readActionReference(value: string, keys: AuthActionProtocolKeys): ActionReference | null {
  try {
    if (value.length > 1024) return null
    const pieces = value.split('.')
    if (pieces.length !== 3) return null
    const [version, encoded, signature] = pieces as [string, string, string]
    const key = validatedRecoveryKeys(keys.reference)?.find((key) => key.version === version)
    if (!key || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null
    const expected = createHmac('sha256', key.secret)
      .update(JSON.stringify(['auth-action-reference-v1', version, encoded]))
      .digest()
    if (!equalSignature(expected, signature)) return null
    const decoded = Buffer.from(encoded, 'base64url')
    if (decoded.toString('base64url') !== encoded) return null
    const reference = referenceSchema.safeParse(JSON.parse(decoded.toString('utf8')))
    return reference.success && reference.data.environment === keys.environment ? reference.data : null
  } catch {
    return null
  }
}

export function createConfiguredActionReference(
  input: { actionId: number; flow: DashboardActionFlow },
  environment: AuthActionProtocolKeys['environment'],
  keys?: AuthActionProtocolKeys,
) {
  const configured = keys ?? resolveAuthActionProtocolKeys(environment)
  if (configured.environment !== environment) throw new Error('Auth-action protocol configuration unavailable.')
  return createActionReference(input, configured)
}

export function resolveAuthActionProtocolKeys(
  environment: AuthActionProtocolKeys['environment'],
  env: Record<string, string | undefined> = process.env,
): AuthActionProtocolKeys {
  try {
    const input = z
      .object({
        environment: z.enum(authActionEnvironments),
        service: z.array(z.object({ version: z.string(), secret: z.string() }).strict()).min(1),
        reference: z.array(z.object({ version: z.string(), secret: z.string() }).strict()).min(1),
      })
      .strict()
      .parse(JSON.parse(env.AUTH_ACTION_PROTOCOL_KEYS_JSON ?? ''))
    const service = validatedRecoveryKeys(input.service)
    const reference = validatedRecoveryKeys(input.reference)
    if (
      input.environment !== environment ||
      !service ||
      !reference ||
      service.some((shared) => reference.some((privateKey) => privateKey.secret === shared.secret))
    )
      throw new Error()
    return { environment, service, reference }
  } catch {
    throw new Error('Auth-action protocol configuration unavailable.')
  }
}
