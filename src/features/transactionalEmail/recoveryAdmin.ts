import { createHash, randomUUID } from 'node:crypto'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'
import type { RecoveryPrincipal } from '@/auth/actions/recoveryPrincipal'
import type { EmailEnvironment } from './environment'

/** Offline recovery uses synthetic identity/link evidence and never constructs the live SDK. */
export async function recoveryAdmin(environment: EmailEnvironment, principal: RecoveryPrincipal, signal?: AbortSignal) {
  signal?.throwIfAborted()
  if (environment === 'preview' || environment === 'production') return (await createAdminClient(signal)).auth.admin
  const user = {
    id: principal.document.supabaseUserId!,
    email: principal.document.email ?? undefined,
    app_metadata: { user_type: principal.userType },
    user_metadata: {},
    aud: 'authenticated',
    created_at: principal.document.createdAt,
  } satisfies User
  return {
    async getUserById() {
      return { data: { user }, error: null }
    },
    async generateLink() {
      return {
        data: {
          user,
          properties: {
            action_link: '',
            email_otp: '',
            redirect_to: '',
            verification_type: 'recovery' as const,
            hashed_token: createHash('sha224').update(randomUUID()).digest('hex'),
          },
        },
        error: null,
      }
    },
  }
}
