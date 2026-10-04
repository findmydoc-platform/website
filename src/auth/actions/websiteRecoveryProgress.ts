import { createHmac } from 'node:crypto'
import { z } from 'zod'
import type { User } from '@supabase/supabase-js'
import type { AuthAction } from '@/payload-types'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'
import type { RecoveryKey } from './recoveryContext'
import type { RecoveryExecution } from './websiteRecoveryExecution'

const schema = z
  .object({
    operation: z.string().regex(/^[a-f0-9]{64}$/),
    expiresAt: z.number().int().positive(),
    state: z.enum(['ready', 'started', 'password-updated']),
    attempt: z.number().int().nonnegative().max(100),
  })
  .strict()
type Progress = z.infer<typeof schema>

/** One bounded, server-written progress slot per environment; no credentials, identity or action journal. */
export function websiteRecoveryProgress(action: AuthAction, environment: string, keys: readonly RecoveryKey[]) {
  const field = `findmydoc_recovery_progress_v1_${environment}`
  const expiresAt = Date.parse(action.expiresAt)
  function operation(key: RecoveryKey) {
    return createHmac('sha256', key.secret)
      .update(
        JSON.stringify([
          'website-recovery-progress-v1',
          environment,
          action.actionType,
          action.id,
          action.supabaseSubject,
          expiresAt,
        ]),
      )
      .digest('hex')
  }
  const operations = keys.map(operation)
  return {
    read(user: User): { own: boolean; progress: Progress } | null {
      const value: unknown = user.app_metadata?.[field]
      if (value === undefined) return null
      const parsed = schema.safeParse(value)
      if (!parsed.success) throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
      const progress = parsed.data
      return { own: progress.expiresAt === expiresAt && operations.includes(progress.operation), progress }
    },
    async write(state: Progress['state'], attempt: number, execution: RecoveryExecution) {
      execution.assertActive()
      const admin = await createAdminClient(execution.signal)
      execution.assertActive()
      // Send only our reserved key. GoTrue merges top-level metadata; never send a copied role/metadata object.
      const result = await admin.auth.admin.updateUserById(action.supabaseSubject!, {
        app_metadata: { [field]: schema.parse({ operation: operations[0]!, expiresAt, state, attempt }) },
      })
      execution.assertActive()
      if (result.error) throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
    },
  }
}
