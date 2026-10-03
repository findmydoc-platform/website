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
import { withWebsiteRecoveryExecution, type RecoveryExecution } from './websiteRecoveryExecution'
import { websiteRecoveryProgress } from './websiteRecoveryProgress'

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
  async function load(id: number, context?: WebsiteRecoveryContext, execution?: RecoveryExecution) {
    execution?.assertActive()
    const action = await actions.read(id).catch((error: unknown) => {
      if (error instanceof APIError && [403, 404, 409].includes(error.status)) invalid()
      throw error
    })
    execution?.assertActive()
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
    execution?.assertActive()
    if (!principal || principal.document.supabaseUserId !== action.supabaseSubject) invalid()
    const correlations = recoveryCorrelations(principal.document.email!, '192.0.2.1', environment, keys)[0]!
      .correlations
    if (
      !correlations.some(
        (key) => key.keyVersion === action.correlationKeyVersion && key.digest === action.correlationDigest,
      )
    )
      invalid()
    const admin = await createAdminClient(execution?.signal)
    execution?.assertActive()
    const result = await admin.auth.admin.getUserById(action.supabaseSubject)
    execution?.assertActive()
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
      return withWebsiteRecoveryExecution(
        payload,
        environment,
        context.actionId,
        context.subject,
        async (execution) => {
          const source = await load(context.actionId, context, execution)
          if (context.stage !== 'pending' && context.stage !== 'confirmed') invalid()
          const initial = websiteRecoveryProgress(source.action, environment, keys).read(source.user)
          if (initial?.progress.state === 'started') throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
          if (context.progressReady && !initial?.own) invalid()
          let grant = context
          if (context.stage === 'pending') {
            const verification = createVerificationClient(execution.signal)
            const result = await verification.auth.verifyOtp({ token_hash: context.tokenHash!, type: 'recovery' })
            execution.assertActive()
            if (result.error) providerFailure(result.error)
            if (
              !result.data.session ||
              !matches(result.data.user, source.user.id, source.user.email!, source.principal.userType)
            )
              invalid()
            grant = confirmedWebsiteRecovery(context)
            try {
              await load(context.actionId, grant, execution)
            } catch (error) {
              if (!(error instanceof InvalidWebsiteRecovery)) {
                execution.assertActive()
                await verification.commitSession()
                execution.assertActive()
                save(grant)
              }
              throw error
            }
            await verification.commitSession()
            execution.assertActive()
            save(grant)
          } else {
            const client = await createClient(execution.signal)
            execution.assertActive()
            const result = await client.auth.getUser()
            execution.assertActive()
            if (result.error) providerFailure(result.error)
            if (!matches(result.data.user, source.user.id, source.user.email!, source.principal.userType)) invalid()
          }
          const { action, user } = await load(context.actionId, grant, execution)
          const progress = websiteRecoveryProgress(action, environment, keys)
          const current = progress.read(user)
          if (current?.progress.state === 'started') throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
          if (grant.progressReady && !current?.own) invalid()
          if (current?.own && current.progress.attempt !== grant.progressAttempt) invalid()
          if (!current?.own) {
            if (grant.progressInitializing) throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
            if (action.state !== 'active' || (current && current.progress.expiresAt >= Date.parse(action.expiresAt)))
              invalid()
            // The owned active->confirmed claim is non-idempotent: only its winner can initialize provider progress.
            await actions.fenceWebsiteRecovery(action.id, true, (predecessor) => {
              const known = websiteRecoveryProgress(predecessor, environment, keys).read(user)
              return Boolean(known?.own && known.progress.state === 'ready')
            })
            execution.assertActive()
            grant = { ...grant, progressInitializing: true }
            save(grant)
            await progress.write('ready', grant.progressAttempt!, execution)
            const fresh = await load(action.id, grant, execution)
            const confirmed = progress.read(fresh.user)
            if (
              !confirmed?.own ||
              confirmed.progress.state !== 'ready' ||
              confirmed.progress.attempt !== grant.progressAttempt
            )
              throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
          }
          grant = { ...grant, progressReady: true, progressInitializing: false }
          const confirmedAction = await load(action.id, grant, execution)
          if (confirmedAction.action.state !== 'confirmed') invalid()
          execution.assertActive()
          save(grant)
          return '/auth/password/reset/complete'
        },
      )
    },
    async complete(context: WebsiteRecoveryContext, password: string, save: (grant: WebsiteRecoveryContext) => void) {
      return withWebsiteRecoveryExecution(
        payload,
        environment,
        context.actionId,
        context.subject,
        async (execution) => {
          if (context.stage === 'pending' || !context.progressReady) invalid()
          const source = await load(context.actionId, context, execution)
          if (context.stage === 'signed-out') {
            await clearLocalAuthSession()
            execution.assertActive()
            return context.destination
          }
          const client = await createClient(execution.signal)
          execution.assertActive()
          const identity = await client.auth.getUser()
          execution.assertActive()
          if (identity.error) providerFailure(identity.error)
          if (!matches(identity.data.user, source.user.id, source.user.email!, source.principal.userType)) invalid()
          let grant = context
          const progress = websiteRecoveryProgress(source.action, environment, keys)
          const current = progress.read(source.user)
          if (!current?.own || current.progress.attempt !== context.progressAttempt) invalid()
          if (context.stage === 'confirmed' && current.progress.state === 'started')
            throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
          if (context.stage === 'confirmed' && current.progress.state === 'password-updated') {
            grant = { ...context, stage: 'password-updated' }
            save(grant)
          }
          if (grant.stage === 'confirmed') {
            if (source.action.state === 'active') await actions.transition({ id: context.actionId, to: 'confirmed' })
            execution.assertActive()
            await actions.fenceWebsiteRecovery(context.actionId)
            execution.assertActive()
            await progress.write('started', grant.progressAttempt!, execution)
            const startedSource = await load(context.actionId, grant, execution)
            const started = progress.read(startedSource.user)
            if (
              !started?.own ||
              started.progress.state !== 'started' ||
              started.progress.attempt !== grant.progressAttempt
            )
              throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
            const result = await client.auth.updateUser({ password })
            execution.assertActive()
            if (result.error) {
              if (result.error.status === 422 && ['weak_password', 'same_password'].includes(result.error.code ?? '')) {
                const nextAttempt = grant.progressAttempt! + 1
                await progress.write('ready', nextAttempt, execution)
                const fresh = await load(context.actionId, grant, execution)
                const ready = progress.read(fresh.user)
                if (!ready?.own || ready.progress.state !== 'ready' || ready.progress.attempt !== nextAttempt)
                  throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
                save({ ...grant, progressAttempt: nextAttempt })
                throw new RecoveryPasswordRejected('PASSWORD_REJECTED')
              }
              if (result.error.status === 401 || result.error.status === 403) invalid()
              throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
            }
            if (!matches(result.data.user, source.user.id, source.user.email!, source.principal.userType)) invalid()
            grant = { ...context, stage: 'password-updated' }
            save(grant)
            execution.assertActive()
          }
          if (grant.stage === 'password-updated' && current.progress.state !== 'password-updated') {
            await progress.write('password-updated', grant.progressAttempt!, execution)
            const fresh = await load(context.actionId, grant, execution)
            const success = progress.read(fresh.user)
            if (
              !success?.own ||
              success.progress.state !== 'password-updated' ||
              success.progress.attempt !== grant.progressAttempt
            )
              throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
          } else if (grant.stage !== 'password-updated' && current.progress.state !== 'password-updated') invalid()
          const { action } = await load(context.actionId, grant, execution)
          if (action.state !== 'completed') await actions.transition({ id: action.id, to: 'completed' })
          execution.assertActive()
          grant = { ...grant, stage: 'completed' }
          save(grant)
          const session = await client.auth.getSession()
          execution.assertActive()
          if (session.error) providerFailure(session.error)
          if (!session.data.session) invalid()
          const result = await signOutRecoverySession(session.data.session.access_token, execution.signal)
          execution.assertActive()
          if (result.error) throw new Error('RECOVERY_TEMPORARILY_UNAVAILABLE')
          save({ ...grant, stage: 'signed-out' })
          execution.assertActive()
          await clearLocalAuthSession()
          execution.assertActive()
          return grant.destination
        },
      )
    },
  }
}
