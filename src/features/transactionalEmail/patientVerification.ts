import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { AuthAction } from '@/payload-types'
import { z } from 'zod'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { verificationCorrelations, type VerificationCorrelationKey } from '@/auth/actions/verificationCorrelation'
import { authActionPolicies } from '@/auth/actions/contracts'
import type { EmailEnvironment } from './environment'
import type { CatalogEntry, CatalogRevalidation } from './catalog'
import type { TransactionalEmailCommand } from './commands'
import { TransactionalEmailError } from './errors'
import { renderPatientEmailVerification } from './preparation'

type Command = Extract<TransactionalEmailCommand, { type: 'auth.email-verification' }>
const policy = authActionPolicies['patient-verification']
type Admin = Pick<SupabaseClient['auth']['admin'], 'getUserById' | 'generateLink'>
type Dependencies = {
  environment: EmailEnvironment
  now?: () => number
  verificationKeys: readonly VerificationCorrelationKey[] | (() => readonly VerificationCorrelationKey[])
  actions: { read(id: number): Promise<AuthAction | null> }
  admin(): Promise<Admin>
}

export function patientVerificationCallback(environment: EmailEnvironment, id: number): URL {
  const origins: Record<EmailEnvironment, string> = {
    preview: 'https://preview.findmydoc.eu',
    production: 'https://findmydoc.eu',
    local: 'http://localhost:3000',
    test: 'https://example.test',
    ci: 'https://example.test',
  }
  const callback = new URL('/auth/callback', origins[environment])
  callback.searchParams.set('authActionId', String(id))
  return callback
}

function sameIdentity(user: User | null, action: AuthAction, observedAt: number, email?: string): user is User {
  return Boolean(
    user &&
    user.id === action.supabaseSubject &&
    !user.email_confirmed_at &&
    user.app_metadata?.user_type === 'patient' &&
    user.email &&
    (!email || normalizeEmail(user.email) === email) &&
    (!user.banned_until || Date.parse(user.banned_until) <= observedAt),
  )
}

/** Auth supplies the private action authority; delivery resolves only its current bound identity. */
export function createPatientVerificationCatalogEntry(dependencies: Dependencies): CatalogEntry<Command> {
  const now = dependencies.now ?? Date.now
  async function load(command: Command): Promise<{ action: AuthAction; email: string; admin: Admin } | null> {
    const action = await dependencies.actions.read(command.authActionId)
    if (
      !action ||
      action.id !== command.authActionId ||
      action.actionType !== 'patient-verification' ||
      action.environment !== dependencies.environment ||
      action.state !== 'active' ||
      !z.string().uuid().safeParse(action.supabaseSubject).success ||
      action.callbackDestination !== policy.callbackDestination ||
      action.finalDestination !== policy.finalDestination ||
      action.completionRoute !== policy.completionRoute ||
      action.supabaseTokenType !== policy.supabaseTokenType ||
      !Number.isFinite(Date.parse(action.createdAt)) ||
      Date.parse(action.createdAt) > now() ||
      Date.parse(action.expiresAt) !== Date.parse(action.createdAt) + policy.lifetime ||
      Date.parse(action.expiresAt) <= now()
    )
      return null
    const admin = await dependencies.admin()
    const result = await admin.getUserById(action.supabaseSubject!)
    if (result.error) throw new TransactionalEmailError('source-missing')
    const user = result.data.user
    if (!sameIdentity(user, action, now())) return null
    const email = normalizeEmail(user.email!)
    const keys =
      typeof dependencies.verificationKeys === 'function'
        ? dependencies.verificationKeys()
        : dependencies.verificationKeys
    if (
      !verificationCorrelations(email, dependencies.environment, keys).some(
        (key) =>
          key.correlationKeyVersion === action.correlationKeyVersion &&
          key.correlationDigest === action.correlationDigest,
      )
    )
      return null
    return { action, email, admin }
  }

  async function revalidate(command: Command): Promise<CatalogRevalidation> {
    const source = await load(command)
    if (!source) return { status: 'suppressed', outcomeCode: 'ineligible' }
    const binding = JSON.stringify([
      'patient-verification-v1',
      source.action.id,
      source.action.supabaseSubject,
      source.email,
      source.action.expiresAt,
      source.action.callbackDestination,
    ])
    return {
      status: 'eligible',
      recipient: { address: source.email, binding },
      async prepare() {
        const current = await load(command)
        if (
          !current ||
          current.email !== source.email ||
          current.action.supabaseSubject !== source.action.supabaseSubject
        )
          throw new TransactionalEmailError('source-missing')
        const callback = patientVerificationCallback(dependencies.environment, current.action.id)
        const generated = await current.admin.generateLink({
          type: policy.supabaseTokenType,
          email: current.email,
          options: { redirectTo: callback.toString() },
        })
        if (
          generated.error ||
          !sameIdentity(generated.data.user, current.action, now(), current.email) ||
          generated.data.properties?.verification_type !== policy.supabaseTokenType ||
          !z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .safeParse(generated.data.properties?.hashed_token).success
        )
          throw new TransactionalEmailError('source-missing')
        callback.searchParams.set('token_hash', generated.data.properties.hashed_token)
        callback.searchParams.set('type', policy.supabaseTokenType)
        return renderPatientEmailVerification(current.email, callback.toString())
      },
    }
  }

  return {
    isRecipientAllowed: () => true,
    async authorizeAndResolve(command, actor) {
      if (actor !== null) throw new TransactionalEmailError('access-denied')
      const decision = await revalidate(command)
      if (decision.status !== 'eligible') throw new TransactionalEmailError('source-missing')
      return decision.recipient
    },
    async authValidity(command) {
      const source = await load(command)
      if (!source) throw new TransactionalEmailError('source-missing')
      return { actionAt: source.action.createdAt, lifetimeMilliseconds: policy.lifetime }
    },
    revalidate,
  }
}
