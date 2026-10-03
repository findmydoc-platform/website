import type { User } from '@supabase/supabase-js'
import { APIError, createLocalReq, getPayload } from 'payload'
import configPromise from '@/payload.config'
import { createAdminClient, createClient, createVerificationClient } from '@/auth/utilities/supaBaseServer'
import { ensurePatientOnAuth } from '@/hooks/ensurePatientOnAuth'
import { resolveTransactionalEmailEnvironment } from '@/features/transactionalEmail/environment'
import { authActionPolicies } from './contracts'
import { bindAuthActions } from './lifecycle'
import { resolveVerificationKeys } from './verificationConfiguration'
import { verificationCorrelations } from './verificationCorrelation'
import type { PatientVerificationContext } from './patientVerificationContext'

const policy = authActionPolicies['patient-verification']
export class InvalidPatientVerification extends Error {}
function invalid(): never {
  throw new InvalidPatientVerification('INVALID_OR_EXPIRED_LINK')
}
function providerFailure(error: { status?: number; code?: string }, identityLookup = false): never {
  if (
    identityLookup
      ? error.status === 404 || error.code === 'user_not_found'
      : error.status && error.status >= 400 && error.status < 500 && error.status !== 429
  )
    invalid()
  throw new Error('VERIFICATION_TEMPORARILY_UNAVAILABLE')
}

export async function patientVerificationAuthority() {
  const environment = resolveTransactionalEmailEnvironment()
  const keys = resolveVerificationKeys(environment)
  const payload = await getPayload({ config: configPromise })
  const req = await createLocalReq({}, payload)
  const actions = bindAuthActions(req, { environment, verificationKeys: keys })
  async function load(id: number, context?: PatientVerificationContext) {
    const action = await actions.read(id).catch((error: unknown) => {
      if (error instanceof APIError && [403, 404, 409].includes(error.status)) invalid()
      throw error
    })
    const now = Date.now()
    if (
      !action ||
      action.actionType !== 'patient-verification' ||
      action.environment !== environment ||
      action.supabaseTokenType !== policy.supabaseTokenType ||
      action.callbackDestination !== policy.callbackDestination ||
      action.completionRoute !== policy.completionRoute ||
      action.finalDestination !== policy.finalDestination ||
      !action.supabaseSubject ||
      !['active', 'confirmed', 'completed'].includes(action.state) ||
      !Number.isFinite(Date.parse(action.createdAt)) ||
      Date.parse(action.createdAt) > now ||
      Date.parse(action.expiresAt) !== Date.parse(action.createdAt) + policy.lifetime ||
      Date.parse(action.expiresAt) <= now ||
      (context
        ? context.actionId !== action.id ||
          context.subject !== action.supabaseSubject ||
          (context.stage === 'pending' && action.state !== 'active')
        : action.state !== 'active')
    )
      invalid()
    const admin = await createAdminClient()
    const result = await admin.auth.admin.getUserById(action.supabaseSubject)
    if (result.error) providerFailure(result.error, true)
    const user = result.data.user
    if (
      !user ||
      user.id !== action.supabaseSubject ||
      !user.email ||
      user.app_metadata?.user_type !== 'patient' ||
      (user.banned_until && Date.parse(user.banned_until) > now) ||
      (context?.stage === 'confirmed' ? !user.email_confirmed_at : user.email_confirmed_at) ||
      !verificationCorrelations(user.email, environment, keys).some(
        (key) =>
          key.correlationKeyVersion === action.correlationKeyVersion &&
          key.correlationDigest === action.correlationDigest,
      )
    )
      invalid()
    return { action, user }
  }
  function verified(user: User | null, expected: User): user is User {
    return Boolean(
      user &&
      user.id === expected.id &&
      user.email === expected.email &&
      user.email_confirmed_at &&
      user.app_metadata?.user_type === 'patient' &&
      (!user.banned_until || Date.parse(user.banned_until) <= Date.now()),
    )
  }
  return {
    environment,
    keys,
    load,
    async confirm(
      context: PatientVerificationContext,
      saveConfirmation: (context: PatientVerificationContext) => void,
    ) {
      const source = await load(context.actionId, context)
      const expected = source.user
      let action = source.action
      let user: User | null
      let commitConfirmation: (() => Promise<void>) | undefined
      if (context.stage === 'confirmed') {
        const supabase = await createClient()
        const result = await supabase.auth.getUser()
        if (result.error) providerFailure(result.error)
        user = result.data.user
      } else {
        const verification = createVerificationClient()
        const result = await verification.auth.verifyOtp({
          token_hash: context.tokenHash!,
          type: 'magiclink',
        })
        if (result.error) providerFailure(result.error)
        if (!result.data.session || !verified(result.data.user, expected)) invalid()
        user = result.data.user
        const { tokenHash: _token, ...receipt } = context
        commitConfirmation = async () => {
          await verification.commitSession()
          saveConfirmation({ ...receipt, expiresAt: Date.parse(action.expiresAt), stage: 'confirmed' })
        }
      }
      if (!verified(user, expected)) invalid()
      // Recheck the current action and identity after the external, non-retryable token consumption.
      const receipt = { ...context, stage: 'confirmed' as const, tokenHash: undefined }
      try {
        ;({ action } = await load(context.actionId, receipt))
      } catch (error) {
        // Retain the already verified identity for technical retries, never for a rejected current authority.
        if (!(error instanceof InvalidPatientVerification)) await commitConfirmation?.()
        throw error
      }
      await commitConfirmation?.()
      if (action.state === 'completed') return policy.completionRoute
      if (action.state === 'active') await actions.transition({ id: action.id, to: 'confirmed' })
      const patient = await ensurePatientOnAuth({
        payload,
        req,
        authData: {
          supabaseUserId: user.id,
          userEmail: user.email!,
          userType: 'patient',
          firstName: typeof user.user_metadata?.first_name === 'string' ? user.user_metadata.first_name : undefined,
          lastName: typeof user.user_metadata?.last_name === 'string' ? user.user_metadata.last_name : undefined,
        },
      })
      if (!patient || patient.supabaseUserId !== user.id) invalid()
      await actions.bindPrincipal({ id: action.id, principal: { relationTo: 'patients', value: patient.id } })
      await actions.transition({ id: action.id, to: 'completed' })
      return policy.completionRoute
    },
  }
}
