import { createHash } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { z } from 'zod'
import type { User } from '@supabase/supabase-js'
import type { AuthAction } from '@/payload-types'
import { bindProtocolStorage } from './storage'

const successSchema = z
  .object({
    actionId: z.number().int().positive(),
    flow: z.enum(['clinic-invitation', 'clinic-recovery']),
    expiresAt: z.number().int().positive(),
    subjectBinding: z.string().regex(/^[a-f0-9]{64}$/),
    outcome: z.literal('password-updated'),
  })
  .strict()
type PasswordResult = { error: { status?: number; code?: string } | null; data: { user: User | null } }

/** The Website observes the ordinary user-password result. An uncertain attempt never authorizes another writer. */
export function bindProtocolPasswordCompletion(req: PayloadRequest, environment: string) {
  const namespace = `auth-action-password:v1:${environment}:`
  const storage = bindProtocolStorage(req, namespace)
  async function read(key: string) {
    return (await storage.read(key))?.data
  }
  async function append(key: string, data: Record<string, unknown>) {
    return storage.append(key, data)
  }
  async function remove(id: number) {
    await storage.remove(id)
  }
  function subjectBinding(subject: string) {
    return createHash('sha256')
      .update(JSON.stringify(['auth-action-password-subject-v1', environment, subject]))
      .digest('hex')
  }
  function expected(action: AuthAction, subject: string) {
    return successSchema.parse({
      actionId: action.id,
      flow: action.actionType,
      expiresAt: Date.parse(action.expiresAt),
      subjectBinding: subjectBinding(subject),
      outcome: 'password-updated',
    })
  }
  async function succeeded(action: AuthAction, subject: string) {
    const proof = successSchema.safeParse(await read(`${namespace}success:${action.id}`))
    return proof.success && JSON.stringify(proof.data) === JSON.stringify(expected(action, subject))
  }
  return {
    succeeded,
    async execute(input: {
      action: AuthAction
      subject: string
      requestId: string
      verifyCurrentAuthority(): Promise<void>
      updatePassword(): Promise<PasswordResult>
    }): Promise<'updated' | 'rejected' | 'unavailable'> {
      if (req.transactionID !== undefined) throw new Error('Auth-action protocol unavailable.')
      const { action, subject } = input
      if (action.environment !== environment || action.supabaseSubject !== subject || action.state !== 'confirmed')
        return 'rejected'
      if (await succeeded(action, subject)) return 'updated'
      let lock: { id: number }
      try {
        lock = await append(`${namespace}subject:${subjectBinding(subject)}`, {
          actionId: action.id,
          requestId: input.requestId,
        })
      } catch {
        // Read a known success after a competing invocation, but never adopt its execution claim.
        return (await succeeded(action, subject)) ? 'updated' : 'unavailable'
      }
      try {
        await input.verifyCurrentAuthority()
      } catch {
        await remove(lock.id)
        return 'rejected'
      }
      const result = await input.updatePassword()
      if (result.error) {
        // These ordinary GoTrue checks happen before password persistence; other errors are ambiguous.
        if (result.error.status === 422 && ['weak_password', 'same_password'].includes(result.error.code ?? '')) {
          await remove(lock.id)
          return 'rejected'
        }
        return 'unavailable'
      }
      if (!result.data.user || result.data.user.id !== subject) return 'unavailable'
      await append(`${namespace}success:${action.id}`, expected(action, subject))
      // Keep the subject claim until the Website has committed the corresponding completed action.
      return 'updated'
    },
    async releaseCompleted(action: AuthAction, subject: string) {
      if (action.state !== 'completed' || action.environment !== environment || !(await succeeded(action, subject)))
        throw new Error('Auth-action protocol unavailable.')
      const key = `${namespace}subject:${subjectBinding(subject)}`
      const lock = await storage.read(key)
      if (lock && lock.data && typeof lock.data === 'object' && Reflect.get(lock.data, 'actionId') === action.id)
        await remove(lock.id)
    },
  }
}
