import type { PayloadRequest } from 'payload'
import activationRegistry from '@/features/transactionalEmail/activationRegistry.json' with { type: 'json' }
import { isTransactionalEmailCommandActivationDeclared } from '@/features/transactionalEmail/activationPolicy'
import { resolveTransactionalEmailEnvironment } from '@/features/transactionalEmail/environment'
import { bindAuthActions } from './lifecycle'
import type { AuthAction } from '@/payload-types'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'

function activeEnvironment() {
  const environment = resolveTransactionalEmailEnvironment()
  if (environment !== 'preview' && environment !== 'production') return null
  return isTransactionalEmailCommandActivationDeclared(environment, 'auth.invitation', activationRegistry)
    ? environment
    : null
}

/** An approval hook owns an uncommitted transaction. Its persisted source is the scheduler's handoff. */
export async function requestInitialClinicInvitation(req: PayloadRequest, clinicStaffId: number | string) {
  const environment = activeEnvironment()
  if (!environment) return 'inactive'
  if (req.transactionID !== undefined) return 'deferred'
  const action = await bindAuthActions(req, { environment }).reserveClinicInvitation({
    clinicStaffId: Number(clinicStaffId),
  })
  if (!action) return 'ineligible'
  await acceptClinicInvitationCommand(req, { action, environment })
  return 'prepared'
}

async function acceptClinicInvitationCommand(
  req: PayloadRequest,
  input: { action: AuthAction; environment: 'preview' | 'production'; now?: () => number },
): Promise<boolean> {
  const { action, environment, now } = input
  let acceptedAction = action
  const actions = bindAuthActions(req, { environment, now })
  if (acceptedAction.state === 'pending') {
    acceptedAction = await actions.transition({ id: action.id, to: 'active' })
  }
  if (acceptedAction.state !== 'active') return false
  const systemReq = { ...req, user: null }
  const acceptance = await bindTransactionalEmail(systemReq, undefined, now).accept({
    type: 'auth.invitation',
    authActionId: acceptedAction.id,
  })
  return !acceptance.deduplicated
}

/** Reads committed candidates only. Failed preparation leaves approval and its retry marker untouched. */
export async function prepareCommittedClinicInvitations(
  req: PayloadRequest,
  options: { deadline: number; now?: () => number },
): Promise<void> {
  const environment = activeEnvironment()
  if (!environment) return
  const now = options.now ?? Date.now
  const stop = Math.min(options.deadline, now() + 30000)
  const actions = bindAuthActions(req, { environment, now })
  let afterId = 0
  let prepared = 0
  let failed = false
  const acceptedActionIds = new Set<number>()
  while (now() < stop && prepared < 25) {
    const candidates = await req.payload.find({
      collection: 'clinicStaff',
      req,
      overrideAccess: true,
      depth: 0,
      limit: 25,
      sort: 'id',
      where: {
        and: [
          { id: { greater_than: afterId } },
          { status: { equals: 'approved' } },
          { 'authSync.status': { equals: 'synced' } },
          { invitationAuthorizedAt: { exists: false } },
          { invitationAttemptedAt: { exists: false } },
          { 'accountCompletion.source': { exists: false } },
          { 'legacyAccess.eligibleAt': { exists: false } },
          { onboardingKey: { like: 'clinic-application:' } },
        ],
      },
    })
    if (!candidates.docs.length) break
    for (const staff of candidates.docs) {
      if (now() >= stop || prepared >= 25) break
      afterId = staff.id
      try {
        const action: AuthAction | null = await actions.reserveClinicInvitation({ clinicStaffId: staff.id })
        if (action) {
          const accepted = await acceptClinicInvitationCommand(req, { action, environment, now })
          acceptedActionIds.add(action.id)
          if (accepted) prepared++
        }
      } catch {
        failed = true
        req.payload.logger.error(
          { event: 'auth.clinic_invitation_preparation_failed', clinicStaffId: staff.id },
          'Clinic invitation preparation failed; approval remains unchanged.',
        )
      }
    }
    if (candidates.docs.length < 25) break
  }
  afterId = 0
  while (now() < stop && prepared < 25) {
    const liveActions = await actions.liveClinicInvitations({ afterId, limit: 25 })
    if (!liveActions.length) break
    for (const action of liveActions) {
      if (now() >= stop || prepared >= 25) break
      afterId = action.id
      if (acceptedActionIds.has(action.id)) continue
      try {
        const accepted = await acceptClinicInvitationCommand(req, { action, environment, now })
        if (accepted) prepared++
      } catch {
        failed = true
        req.payload.logger.error(
          { event: 'auth.clinic_invitation_command_acceptance_failed', authActionId: action.id },
          'Clinic invitation command acceptance failed; approval remains unchanged.',
        )
      }
    }
    if (liveActions.length < 25) break
  }
  if (failed) throw new Error('Clinic invitation preparation unavailable.')
}
