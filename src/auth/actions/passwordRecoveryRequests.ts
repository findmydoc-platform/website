import type { AuthAction } from '@/payload-types'
import type { PayloadRequest } from 'payload'
import { createLocalReq } from 'payload'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'
import {
  bindTransactionalEmail,
  selectTransactionalEmailCommandAcceptance,
} from '@/features/transactionalEmail/payloadIntegration'
import { resolveTransactionalEmailEnvironment } from '@/features/transactionalEmail/environment'
import { bindAuthActions } from './lifecycle'
import { resolveRecoveryKeys } from './recoveryConfiguration'
import type { RecoveryContext } from './recoveryContext'

async function acceptRecovery(
  req: PayloadRequest,
  action: AuthAction,
  environment: ReturnType<typeof resolveTransactionalEmailEnvironment>,
  now?: () => number,
) {
  const actions = bindAuthActions(req, { environment, now })
  const active = action.state === 'pending' ? await actions.transition({ id: action.id, to: 'active' }) : action
  if (active.state !== 'active') return false
  const receipt = await bindTransactionalEmail({ ...req, user: null }, undefined, now).accept({
    type: 'auth.password-recovery',
    authActionId: active.id,
  })
  return !receipt.deduplicated
}

/** The public adapter catches all admission/acceptance outcomes into the same neutral response. */
export async function requestPasswordRecovery(
  req: PayloadRequest,
  input: { email: string; context: RecoveryContext | null },
) {
  const email = normalizeEmail(input.email)
  if (!isValidEmail(email) || email.length > 254) throw new Error('Invalid recovery request.')
  if (req.transactionID !== undefined) throw new Error('Recovery transaction unavailable.')
  if (selectTransactionalEmailCommandAcceptance('auth.password-recovery').kind !== 'active') return
  const environment = resolveTransactionalEmailEnvironment()
  const recoveryKeys = resolveRecoveryKeys(environment)
  const sourceReq = await createLocalReq({}, req.payload)
  const action = await bindAuthActions(sourceReq, { environment, recoveryKeys }).reserveRecovery({
    email,
    context: input.context,
  })
  if (action) await acceptRecovery(sourceReq, action, environment)
}

/** Keyset paging and the deadline bound recovery. Duplicate receipts do not consume the new acceptance cap. */
export async function prepareCommittedRecoveries(
  req: PayloadRequest,
  options: { deadline: number; now?: () => number },
) {
  if (selectTransactionalEmailCommandAcceptance('auth.password-recovery').kind !== 'active') return
  const environment = resolveTransactionalEmailEnvironment()
  const now = options.now ?? Date.now
  const stop = Math.min(options.deadline, now() + 30000)
  const actions = bindAuthActions(req, { environment, now })
  let afterId = 0
  let prepared = 0
  let failed = false
  while (now() < stop && prepared < 25) {
    const live = await actions.liveRecoveries({ afterId, limit: 25 })
    if (!live.length) break
    for (const action of live) {
      if (now() >= stop || prepared >= 25) break
      afterId = action.id
      try {
        if (await acceptRecovery(req, action, environment, now)) prepared++
      } catch {
        failed = true
        req.payload.logger.error(
          { event: 'auth.recovery_command_acceptance_failed', authActionId: action.id },
          'Recovery command acceptance failed.',
        )
      }
    }
    if (live.length < 25) break
  }
  if (failed) throw new Error('Recovery command acceptance unavailable.')
}
