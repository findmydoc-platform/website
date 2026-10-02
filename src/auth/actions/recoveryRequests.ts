import type { PayloadRequest } from 'payload'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import { bindAuthActions } from './lifecycle'
import type { RecoveryContext } from './recoveryContext'

/** Public response boundary for future Website/Dashboard adapters; no delivery effects yet. */
export function bindRecoveryRequests(req: PayloadRequest, options: Parameters<typeof bindAuthActions>[1]) {
  const actions = bindAuthActions(req, options)
  return Object.freeze({
    async request(input: { email: string; context: RecoveryContext | null }): Promise<Response> {
      const email = normalizeEmail(input.email)
      const headers = { 'Cache-Control': 'no-store' }
      if (!isValidEmail(email) || email.length > 254) return Response.json({ ok: false }, { status: 400, headers })
      try {
        await actions.reserveRecovery({ email, context: input.context })
      } catch {
        // Infrastructure, eligibility and limits must not disclose account existence or private database details.
      }
      return Response.json({ ok: true }, { headers })
    },
  })
}
