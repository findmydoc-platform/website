import { APIError, type PayloadRequest } from 'payload'
import { z } from 'zod'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { bindAuthActions } from './lifecycle'

const commandSchema = z
  .object({
    email: z.string().max(254),
    password: z.string().min(6).max(4096),
    resendOf: z.number().int().positive().optional(),
  })
  .strict()
type Admin = Pick<SupabaseClient['auth']['admin'], 'createUser' | 'listUsers'>

function unavailable(): never {
  throw new APIError('identity-unavailable', 503)
}
function eligible(user: User, email: string) {
  return (
    normalizeEmail(user.email) === email &&
    !user.email_confirmed_at &&
    user.app_metadata?.user_type === 'patient' &&
    z.string().uuid().safeParse(user.id).success
  )
}

async function reconcile(admin: Admin, email: string): Promise<User> {
  const matches: User[] = []
  const perPage = 1000
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage })
    if (error || !data) unavailable()
    matches.push(...data.users.filter((user) => normalizeEmail(user.email) === email))
    // The SDK truncates multi-digit Link header page numbers. Advance using the requested page size instead.
    if (data.users.length < perPage) break
  }
  if (matches.length !== 1 || !eligible(matches[0]!, email)) unavailable()
  return matches[0]!
}

/** Internal preparation only. The trusted Auth caller authorizes resends before entering this boundary. */
export function bindPendingPatientVerification(
  req: PayloadRequest,
  options: Parameters<typeof bindAuthActions>[1] & { admin: Admin },
) {
  const actions = bindAuthActions(req, options)
  return Object.freeze({
    async prepare(input: z.infer<typeof commandSchema>) {
      const parsed = commandSchema.safeParse(input)
      if (!parsed.success) throw new APIError('invalid-command', 400)
      const { password, resendOf } = parsed.data
      const email = normalizeEmail(parsed.data.email)
      const action = await actions.reservePatientVerification({ email, ...(resendOf == null ? {} : { resendOf }) })
      if (action.supabaseSubject) return action
      let user: User | null = null
      // External identity effects must never run inside an automatically retried database transaction.
      try {
        const result = await options.admin.createUser({
          email,
          password,
          email_confirm: false,
          app_metadata: { user_type: 'patient' },
        })
        if (!result.error && result.data.user && eligible(result.data.user, email)) user = result.data.user
      } catch {
        // A missing response does not prove that creation failed. Reconcile without replacing a password.
      }
      if (!user) {
        try {
          user = await reconcile(options.admin, email)
        } catch {
          unavailable()
        }
      }
      if (!user) unavailable()
      return actions.bindSubject({ id: action.id, supabaseSubject: user.id })
    },
  })
}
