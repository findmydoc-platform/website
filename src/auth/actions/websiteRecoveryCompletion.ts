import { APIError, createLocalReq, getPayload } from 'payload'
import type { User } from '@supabase/supabase-js'
import configPromise from '@/payload.config'
import {
  createAdminClient,
  createClient,
  createVerificationClient,
  clearLocalAuthSession,
  signOutRecoverySession,
} from '@/auth/utilities/supaBaseServer'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { resolveTransactionalEmailEnvironment } from '@/features/transactionalEmail/environment'
import { bindAuthActions } from './lifecycle'
import { authActionPolicies } from './contracts'
import { resolveRecoveryKeys } from './recoveryConfiguration'
import { readRecoveryPrincipal } from './recoveryPrincipal'
import { recoveryCorrelations } from './recoveryCorrelation'
import { confirmedWebsiteRecovery, type WebsiteRecoveryContext } from './websiteRecoveryContext'

export class InvalidWebsiteRecovery extends Error {}
export class RecoveryPasswordRejected extends Error {}
function invalid(): never {
  throw new InvalidWebsiteRecovery('INVALID_OR_EXPIRED_LINK')
}
export async function websiteRecoveryAuthority() {
  const environment = resolveTransactionalEmailEnvironment()
  const keys = resolveRecoveryKeys(environment)
  const payload = await getPayload({ config: configPromise })
  const req = await createLocalReq({}, payload)
  const actions = bindAuthActions(req, { environment, recoveryKeys: keys })
  async function load(id: number, context?: WebsiteRecoveryContext) {
    const action = await actions.read(id).catch((error: unknown) => {
      if (error instanceof APIError && [403, 404, 409].includes(error.status)) invalid()
      throw error
    })
    if (!action || (action.actionType !== 'patient-recovery' && action.actionType !== 'platform-recovery')) invalid()
    const policy = authActionPolicies[action.actionType]
    const now = Date.now()
    const states = context
      ? context.stage === 'pending'
        ? ['active']
        : context.stage === 'confirmed'
          ? ['active', 'confirmed']
          : context.stage === 'signed-out'
            ? ['completed']
            : ['confirmed', 'completed']
      : ['active']
    if (
      action.environment !== environment ||
      !states.includes(action.state) ||
      action.supabaseTokenType !== 'recovery' ||
      action.callbackDestination !== policy.callbackDestination ||
      action.completionRoute !== policy.completionRoute ||
      action.finalDestination !== policy.finalDestination ||
      !action.supabaseSubject ||
      !action.principal ||
      action.principal.relationTo !== policy.principalCollection ||
      Date.parse(action.createdAt) > now ||
      Date.parse(action.expiresAt) !== Date.parse(action.createdAt) + policy.lifetime ||
      Date.parse(action.expiresAt) <= now ||
      (context &&
        (context.actionId !== id || context.flow !== action.actionType || context.subject !== action.supabaseSubject))
    )
      invalid()
    const principalId = typeof action.principal.value === 'number' ? action.principal.value : action.principal.value.id
    const principal = await readRecoveryPrincipal(req, policy.principalCollection, principalId)
    if (!principal || principal.document.supabaseUserId !== action.supabaseSubject) invalid()
    const correlations = recoveryCorrelations(principal.document.email!, '192.0.2.1', environment, keys)[0]!
      .correlations
    if (
      !correlations.some(
        (key) => key.keyVersion === action.correlationKeyVersion && key.digest === action.correlationDigest,
      )
    )
      invalid()
    const admin = await createAdminClient()
    const result = await admin.auth.admin.getUserById(action.supabaseSubject)
    if (result.error) {
      if (result.error.status === 404 || result.error.code === 'user_not_found') invalid()
      throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
    }
    const user = result.data.user
    if (!matches(user, action.supabaseSubject, principal.document.email!, principal.userType)) invalid()
    return { action, principal, user: user! }
  }
  function matches(user: User | null, subject: string, email: string, userType: string) {
    return Boolean(
      user &&
      user.id === subject &&
      normalizeEmail(user.email) === normalizeEmail(email) &&
      user.app_metadata?.user_type === userType &&
      (!user.banned_until || Date.parse(user.banned_until) <= Date.now()),
    )
  }
  function providerFailure(error: { status?: number }): never {
    if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) invalid()
    throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
  }
  return {
    environment,
    keys,
    load,
    async confirm(context: WebsiteRecoveryContext, save: (grant: WebsiteRecoveryContext) => void) {
      const source = await load(context.actionId, context)
      if (context.stage !== 'pending' && context.stage !== 'confirmed') invalid()
      let grant = context
      if (context.stage === 'pending') {
        const verification = createVerificationClient()
        const result = await verification.auth.verifyOtp({ token_hash: context.tokenHash!, type: 'recovery' })
        if (result.error) providerFailure(result.error)
        if (
          !result.data.session ||
          !matches(result.data.user, source.user.id, source.user.email!, source.principal.userType)
        )
          invalid()
        grant = confirmedWebsiteRecovery(context)
        try {
          await load(context.actionId, grant)
        } catch (error) {
          if (!(error instanceof InvalidWebsiteRecovery)) {
            await verification.commitSession()
            save(grant)
          }
          throw error
        }
        await verification.commitSession()
        save(grant)
      } else {
        const client = await createClient()
        const result = await client.auth.getUser()
        if (result.error) providerFailure(result.error)
        if (!matches(result.data.user, source.user.id, source.user.email!, source.principal.userType)) invalid()
      }
      const { action } = await load(context.actionId, grant)
      if (action.state === 'active') await actions.transition({ id: action.id, to: 'confirmed' })
      save(grant)
      return '/auth/password/reset/complete'
    },
    async complete(context: WebsiteRecoveryContext, password: string, save: (grant: WebsiteRecoveryContext) => void) {
      if (context.stage === 'pending') invalid()
      const source = await load(context.actionId, context)
      if (context.stage === 'signed-out') {
        await clearLocalAuthSession()
        return context.destination
      }
      const client = await createClient()
      const identity = await client.auth.getUser()
      if (identity.error) providerFailure(identity.error)
      if (!matches(identity.data.user, source.user.id, source.user.email!, source.principal.userType)) invalid()
      let grant = context
      if (context.stage === 'confirmed') {
        if (source.action.state === 'active') await actions.transition({ id: context.actionId, to: 'confirmed' })
        const result = await client.auth.updateUser({ password })
        if (result.error) {
          if (result.error.status === 401 || result.error.status === 403) invalid()
          if (
            result.error.status &&
            result.error.status >= 400 &&
            result.error.status < 500 &&
            result.error.status !== 429
          )
            throw new RecoveryPasswordRejected('PASSWORD_REJECTED')
          throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
        }
        if (!matches(result.data.user, source.user.id, source.user.email!, source.principal.userType)) invalid()
        grant = { ...context, stage: 'password-updated' }
        save(grant)
      }
      const { action } = await load(context.actionId, grant)
      if (action.state !== 'completed') await actions.transition({ id: action.id, to: 'completed' })
      grant = { ...grant, stage: 'completed' }
      save(grant)
      const session = await client.auth.getSession()
      if (session.error) providerFailure(session.error)
      if (!session.data.session) invalid()
      const result = await signOutRecoverySession(session.data.session.access_token)
      if (result.error) throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
      save({ ...grant, stage: 'signed-out' })
      await clearLocalAuthSession()
      return grant.destination
    },
  }
}
