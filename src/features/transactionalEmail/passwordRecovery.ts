import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { AuthAction } from '@/payload-types'
import { z } from 'zod'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { authActionPolicies } from '@/auth/actions/contracts'
import { recoveryActionTypes, type RecoveryPrincipal } from '@/auth/actions/recoveryPrincipal'
import { recoveryCorrelations } from '@/auth/actions/recoveryCorrelation'
import type { RecoveryKey } from '@/auth/actions/recoveryContext'
import { getClinicDashboardOrigin } from '@/auth/utilities/clinicDashboardOrigin'
import { createConfiguredActionReference, type AuthActionProtocolKeys } from '@/auth/actions/protocol/credentials'
import type { EmailEnvironment } from './environment'
import type { CatalogEntry, CatalogRevalidation } from './catalog'
import type { TransactionalEmailCommand } from './commands'
import { TransactionalEmailError } from './errors'
import { renderPasswordRecovery } from './preparation'
import { patientVerificationCallback } from './patientVerification'

type Command = Extract<TransactionalEmailCommand, { type: 'auth.password-recovery' }>
type Admin = Pick<SupabaseClient['auth']['admin'], 'getUserById' | 'generateLink'>
type Dependencies = {
  environment: EmailEnvironment
  signal?: AbortSignal
  now?: () => number
  recoveryKeys: readonly RecoveryKey[] | (() => readonly RecoveryKey[])
  actions: { read(id: number): Promise<AuthAction | null> }
  findPrincipal(collection: RecoveryPrincipal['collection'], id: number): Promise<RecoveryPrincipal | null>
  admin(principal: RecoveryPrincipal): Promise<Admin>
  dashboardOrigin?: () => string
  actionReferenceKeys?: AuthActionProtocolKeys
}

function sameIdentity(user: User | null, action: AuthAction, principal: RecoveryPrincipal, now: number): user is User {
  return Boolean(
    user &&
    user.id === action.supabaseSubject &&
    user.id === principal.document.supabaseUserId &&
    user.app_metadata?.user_type === principal.userType &&
    user.email &&
    normalizeEmail(user.email) === normalizeEmail(principal.document.email) &&
    (!user.banned_until || Date.parse(user.banned_until) <= now),
  )
}

/** One command derives its closed principal variant from the action and current Payload authority. */
export function createPasswordRecoveryCatalogEntry(dependencies: Dependencies): CatalogEntry<Command> {
  const now = dependencies.now ?? Date.now
  async function load(command: Command) {
    dependencies.signal?.throwIfAborted()
    const action = await dependencies.actions.read(command.authActionId)
    dependencies.signal?.throwIfAborted()
    if (!action || !recoveryActionTypes.includes(action.actionType as never)) return null
    const actionType = action.actionType as (typeof recoveryActionTypes)[number]
    const policy = authActionPolicies[actionType]
    const value = action.principal?.value
    const principalId = typeof value === 'object' && value !== null ? value.id : value
    if (
      action.id !== command.authActionId ||
      action.environment !== dependencies.environment ||
      action.state !== 'active' ||
      action.principal?.relationTo !== policy.principalCollection ||
      !z.number().int().positive().safeParse(principalId).success ||
      !z.string().uuid().safeParse(action.supabaseSubject).success ||
      !Number.isFinite(Date.parse(action.principalBoundAt ?? '')) ||
      !Number.isFinite(Date.parse(action.subjectBoundAt ?? '')) ||
      action.callbackDestination !== policy.callbackDestination ||
      action.completionRoute !== policy.completionRoute ||
      action.finalDestination !== policy.finalDestination ||
      action.supabaseTokenType !== policy.supabaseTokenType ||
      !Number.isFinite(Date.parse(action.createdAt)) ||
      Date.parse(action.createdAt) > now() ||
      Date.parse(action.expiresAt) !== Date.parse(action.createdAt) + policy.lifetime ||
      Date.parse(action.expiresAt) <= now()
    )
      return null
    const principal = await dependencies.findPrincipal(policy.principalCollection, Number(principalId))
    dependencies.signal?.throwIfAborted()
    if (
      !principal ||
      principal.actionType !== actionType ||
      principal.collection !== policy.principalCollection ||
      principal.document.id !== principalId ||
      principal.document.supabaseUserId !== action.supabaseSubject
    )
      return null
    const email = normalizeEmail(principal.document.email)
    const keys =
      typeof dependencies.recoveryKeys === 'function' ? dependencies.recoveryKeys() : dependencies.recoveryKeys
    if (
      !recoveryCorrelations(email, '', dependencies.environment, keys)[0]!.correlations.some(
        (key) => key.keyVersion === action.correlationKeyVersion && key.digest === action.correlationDigest,
      )
    )
      return null
    const admin = await dependencies.admin(principal)
    dependencies.signal?.throwIfAborted()
    const result = await admin.getUserById(action.supabaseSubject!)
    dependencies.signal?.throwIfAborted()
    if (result.error) throw new TransactionalEmailError('source-missing')
    if (!sameIdentity(result.data.user, action, principal, now())) return null
    return { action, principal, email, admin, policy }
  }
  async function revalidate(command: Command): Promise<CatalogRevalidation> {
    const source = await load(command)
    if (!source) return { status: 'suppressed', outcomeCode: 'ineligible' }
    const binding = JSON.stringify([
      'password-recovery-v1',
      source.action.id,
      source.action.actionType,
      source.action.supabaseSubject,
      source.principal.collection,
      source.principal.document.id,
      source.email,
      source.action.expiresAt,
      source.action.callbackDestination,
      source.action.completionRoute,
      source.action.finalDestination,
    ])
    return {
      status: 'eligible',
      recipient: { address: source.email, binding },
      async prepare() {
        const current = await load(command)
        if (
          !current ||
          current.email !== source.email ||
          current.action.supabaseSubject !== source.action.supabaseSubject ||
          current.principal.collection !== source.principal.collection ||
          current.principal.document.id !== source.principal.document.id
        )
          throw new TransactionalEmailError('source-missing')
        const callback =
          current.policy.callbackDestination === 'clinic-dashboard-auth-callback'
            ? new URL('/auth/callback', (dependencies.dashboardOrigin ?? getClinicDashboardOrigin)())
            : patientVerificationCallback(dependencies.environment, current.action.id)
        callback.searchParams.set('authActionId', String(current.action.id))
        if (current.action.actionType === 'clinic-recovery')
          callback.searchParams.set(
            'actionRef',
            createConfiguredActionReference(
              { actionId: current.action.id, flow: 'clinic-recovery' },
              dependencies.environment,
              dependencies.actionReferenceKeys,
            ),
          )
        callback.searchParams.set('next', current.action.completionRoute)
        const generated = await current.admin.generateLink({
          type: 'recovery',
          email: current.email,
          options: { redirectTo: callback.toString() },
        })
        if (
          generated.error ||
          !sameIdentity(generated.data.user, current.action, current.principal, now()) ||
          generated.data.properties?.verification_type !== 'recovery' ||
          !z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .safeParse(generated.data.properties?.hashed_token).success
        )
          throw new TransactionalEmailError('source-missing')
        callback.searchParams.set('token_hash', generated.data.properties.hashed_token)
        callback.searchParams.set('type', 'recovery')
        return renderPasswordRecovery(current.principal.userType, current.email, callback.toString())
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
      return { actionAt: source.action.createdAt, lifetimeMilliseconds: source.policy.lifetime }
    },
    revalidate,
  }
}
