import { APIError, createLocalReq, type PayloadRequest } from 'payload'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'
import { resolveTransactionalEmailEnvironment } from '@/features/transactionalEmail/environment'
import {
  bindTransactionalEmail,
  selectTransactionalEmailCommandAcceptance,
} from '@/features/transactionalEmail/payloadIntegration'
import { bindPendingPatientVerification } from './pendingPatientVerification'
import { bindAuthActions } from './lifecycle'
import { resolveVerificationKeys } from './verificationConfiguration'

type Input = Parameters<ReturnType<typeof bindPendingPatientVerification>['prepare']>[0]

/** Registration retries reuse the action. Only a trusted Auth caller may authorize resendOf. */
export async function requestPatientVerification(req: PayloadRequest, input: Input) {
  if (typeof req.transactionID !== 'undefined') throw new APIError('transaction-unavailable', 503)
  const activation = selectTransactionalEmailCommandAcceptance('auth.email-verification')
  if (activation.kind !== 'active') throw new APIError('verification-unavailable', 503)
  const environment = resolveTransactionalEmailEnvironment()
  const verificationKeys = resolveVerificationKeys(environment)
  const sourceReq = await createLocalReq({}, req.payload)
  const admin = (await createAdminClient()).auth.admin
  const action = await bindPendingPatientVerification(sourceReq, { environment, verificationKeys, admin }).prepare(
    input,
  )
  const actions = bindAuthActions(sourceReq, { environment, verificationKeys })
  if (action.state === 'pending') await actions.transition({ id: action.id, to: 'active' })
  // Identity creation and catalog reads run outside the automatically retried mail-storage transaction.
  await bindTransactionalEmail(sourceReq).accept({ type: 'auth.email-verification', authActionId: action.id })
}

/** The public email-only adapter grants only the existing correlation-limited resend command. */
export async function resendPatientVerification(req: PayloadRequest, input: { email: string }) {
  if (typeof req.transactionID !== 'undefined') throw new APIError('transaction-unavailable', 503)
  if (selectTransactionalEmailCommandAcceptance('auth.email-verification').kind !== 'active')
    throw new APIError('verification-unavailable', 503)
  const environment = resolveTransactionalEmailEnvironment()
  const verificationKeys = resolveVerificationKeys(environment)
  const sourceReq = await createLocalReq({}, req.payload)
  const admin = (await createAdminClient()).auth.admin
  const action = await bindPendingPatientVerification(sourceReq, {
    environment,
    verificationKeys,
    admin,
  }).prepareResend(input)
  await bindAuthActions(sourceReq, { environment, verificationKeys }).transition({ id: action.id, to: 'active' })
  await bindTransactionalEmail(sourceReq).accept({ type: 'auth.email-verification', authActionId: action.id })
}
