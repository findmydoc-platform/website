import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { AuthAction, ClinicStaff } from '@/payload-types'
import { z } from 'zod'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { supabaseEmailTokenHashSchema } from '@/auth/utilities/supabaseEmailTokenHash'
import { authActionPolicies } from '@/auth/actions/contracts'
import { getClinicDashboardOrigin } from '@/auth/utilities/clinicDashboardOrigin'
import { createConfiguredActionReference, type AuthActionProtocolKeys } from '@/auth/actions/protocol/credentials'
import type { EmailEnvironment } from './environment'
import type { CatalogEntry, CatalogRevalidation } from './catalog'
import type { TransactionalEmailCommand } from './commands'
import { TransactionalEmailError } from './errors'
import { renderClinicStaffInvitation } from './preparation'

type Command = Extract<TransactionalEmailCommand, { type: 'auth.invitation' }>
const policy = authActionPolicies['clinic-invitation']
type Admin = Pick<SupabaseClient['auth']['admin'], 'getUserById' | 'generateLink'>
type Dependencies = {
  environment: EmailEnvironment
  now?: () => number
  actions: { read(id: number): Promise<AuthAction | null> }
  findPrincipal(clinicStaffId: number): Promise<ClinicStaff | null>
  admin(): Promise<Admin>
  dashboardOrigin?: () => string
  actionReferenceKeys?: AuthActionProtocolKeys
}

function clinicInvitationCallback(origin: string, id: number): URL {
  const callback = new URL('/auth/callback', origin)
  callback.searchParams.set('authActionId', String(id))
  return callback
}

function relationId(value: unknown): number | undefined {
  const id = typeof value === 'object' && value !== null ? Reflect.get(value, 'id') : value
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : undefined
}

function sameIdentity(user: User | null, staff: ClinicStaff, action: AuthAction, observedAt: number): user is User {
  return Boolean(
    user &&
    user.id === action.supabaseSubject &&
    !user.email_confirmed_at &&
    user.app_metadata?.user_type === 'clinic' &&
    user.app_metadata?.onboarding_key === staff.onboardingKey &&
    user.email &&
    normalizeEmail(user.email) === normalizeEmail(staff.email) &&
    (!user.banned_until || Date.parse(user.banned_until) <= observedAt),
  )
}

/** Auth supplies the private action authority; delivery resolves only its current clinic principal. */
export function createClinicInvitationCatalogEntry(dependencies: Dependencies): CatalogEntry<Command> {
  const now = dependencies.now ?? Date.now
  async function load(
    command: Command,
  ): Promise<{ action: AuthAction; staff: ClinicStaff; email: string; admin: Admin } | null> {
    const action = await dependencies.actions.read(command.authActionId)
    const principalId = relationId(action?.principal?.value)
    if (
      !action ||
      action.id !== command.authActionId ||
      action.actionType !== 'clinic-invitation' ||
      action.environment !== dependencies.environment ||
      action.state !== 'active' ||
      action.principal?.relationTo !== 'clinicStaff' ||
      !principalId ||
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
    const staff = await dependencies.findPrincipal(principalId)
    if (!staff || staff.supabaseUserId !== action.supabaseSubject) return null
    const admin = await dependencies.admin()
    const result = await admin.getUserById(action.supabaseSubject!)
    if (result.error) throw new TransactionalEmailError('source-missing')
    const user = result.data.user
    if (!sameIdentity(user, staff, action, now())) return null
    return { action, staff, email: normalizeEmail(staff.email), admin }
  }

  async function revalidate(command: Command): Promise<CatalogRevalidation> {
    const source = await load(command)
    if (!source) return { status: 'suppressed', outcomeCode: 'ineligible' }
    const binding = JSON.stringify([
      'clinic-invitation-v1',
      source.action.id,
      source.action.supabaseSubject,
      source.staff.id,
      source.staff.onboardingKey,
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
          current.action.supabaseSubject !== source.action.supabaseSubject ||
          current.staff.id !== source.staff.id
        )
          throw new TransactionalEmailError('source-missing')
        const callback = clinicInvitationCallback(
          (dependencies.dashboardOrigin ?? getClinicDashboardOrigin)(),
          current.action.id,
        )
        callback.searchParams.set(
          'actionRef',
          createConfiguredActionReference(
            { actionId: current.action.id, flow: 'clinic-invitation' },
            dependencies.environment,
            dependencies.actionReferenceKeys,
          ),
        )
        const generated = await current.admin.generateLink({
          type: policy.supabaseTokenType,
          email: current.email,
          options: { redirectTo: callback.toString() },
        })
        if (
          generated.error ||
          !sameIdentity(generated.data.user, current.staff, current.action, now()) ||
          generated.data.properties?.verification_type !== policy.supabaseTokenType ||
          !supabaseEmailTokenHashSchema.safeParse(generated.data.properties?.hashed_token).success
        )
          throw new TransactionalEmailError('source-missing')
        callback.searchParams.set('token_hash', generated.data.properties.hashed_token)
        callback.searchParams.set('type', policy.supabaseTokenType)
        return renderClinicStaffInvitation(current.email, callback.toString())
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
