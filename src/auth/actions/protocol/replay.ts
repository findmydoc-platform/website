import { createHmac } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { z } from 'zod'
import type { AuthActionProtocolKeys, AuthActionRequestEnvelope } from './credentials'
import { bindProtocolStorage } from './storage'

const protocolOutcomes = ['accepted', 'valid', 'confirmed', 'completed', 'invalid', 'unavailable'] as const
export type ProtocolOutcome = (typeof protocolOutcomes)[number]
type Claim =
  { kind: 'owned'; finish(outcome: ProtocolOutcome): Promise<void> } | { kind: 'replay'; outcome: ProtocolOutcome }
const claimSchema = z
  .object({ binding: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: z.number().int().positive() })
  .strict()
const receiptSchema = claimSchema.extend({ outcome: z.enum(protocolOutcomes) }).strict()

/** Append-only unique Local API creates arbitrate instances. KV upsert and borrowed transactions are forbidden. */
export function bindProtocolReplay(req: PayloadRequest, keys: AuthActionProtocolKeys, now: () => number = Date.now) {
  const namespace = `auth-action-protocol:v1:${keys.environment}:`
  const storage = bindProtocolStorage(req, namespace)
  async function read(key: string) {
    return (await storage.read(key))?.data
  }
  async function append(key: string, data: Record<string, string | number>) {
    await storage.append(key, data)
  }
  return {
    async claim(input: AuthActionRequestEnvelope, expiresAt: number): Promise<Claim> {
      if (req.transactionID !== undefined || expiresAt <= now()) throw new Error('Auth-action protocol unavailable.')
      const key = keys.service.find((key) => key.version === input.keyVersion)
      if (!key) throw new Error('Auth-action protocol unavailable.')
      const binding = createHmac('sha256', key.secret)
        .update(
          JSON.stringify([
            'auth-action-request-binding-v1',
            keys.environment,
            input.method,
            input.operation,
            input.timestamp,
            input.requestId,
            input.keyVersion,
            input.body,
          ]),
        )
        .digest('hex')
      const requestKey = `${namespace}request:${input.requestId}`
      const receiptKey = `${namespace}receipt:${input.requestId}`
      const data = { binding, expiresAt }
      try {
        await append(requestKey, data)
      } catch {
        // A conflict or lost commit acknowledgement never allows this invocation to execute work.
        const existing = claimSchema.safeParse(await read(requestKey))
        if (!existing.success || existing.data.binding !== binding || existing.data.expiresAt !== expiresAt)
          return { kind: 'replay', outcome: 'invalid' }
        const receipt = receiptSchema.safeParse(await read(receiptKey))
        if (!receipt.success) return { kind: 'replay', outcome: 'unavailable' }
        if (receipt.data.binding !== binding || receipt.data.expiresAt !== expiresAt)
          return { kind: 'replay', outcome: 'invalid' }
        return { kind: 'replay', outcome: receipt.data.outcome }
      }
      return { kind: 'owned', finish: (outcome) => append(receiptKey, { ...data, outcome }) }
    },
    /** Bound cleanup to old protocol records in this environment. Seed and other KV namespaces are untouched. */
    async sweep(): Promise<void> {
      if (req.transactionID !== undefined) throw new Error('Auth-action protocol unavailable.')
      for (const record of await storage.oldest(100)) {
        if (!record.key.startsWith(namespace)) continue
        const parsed = claimSchema.safeParse(record.data)
        const receipt = receiptSchema.safeParse(record.data)
        const expiresAt = parsed.success ? parsed.data.expiresAt : receipt.success ? receipt.data.expiresAt : undefined
        if (expiresAt === undefined || expiresAt > now()) continue
        await storage.remove(record.id)
      }
    },
  }
}
