import configPromise from '@payload-config'
import { createLocalReq, getPayload } from 'payload'
import { runBoundedTransactionalEmailWorker } from './scheduler'
import { createTransactionalEmailWorker } from './worker'
import { selectTransactionalEmailRuntime } from './environment'
import { TransactionalEmailError } from './errors'
import { prepareCommittedRecoveries } from '@/auth/actions/passwordRecoveryRequests'
import { prepareCommittedClinicInvitations } from '@/auth/actions/clinicInvitationRequests'

export async function runHostedTransactionalEmailWorker(deadline: number) {
  const environment = process.env.VERCEL_ENV
  if (environment !== 'preview' && environment !== 'production')
    throw new TransactionalEmailError('environment-unavailable')
  if (String(selectTransactionalEmailRuntime().environment) !== environment)
    throw new TransactionalEmailError('environment-unavailable')

  const payload = await getPayload({ config: configPromise })
  const req = await createLocalReq({}, payload)
  const now = Date.now
  const worker = createTransactionalEmailWorker(req)
  let preparationFailed = false
  try {
    await prepareCommittedClinicInvitations(req, { deadline, now })
  } catch {
    preparationFailed = true
  }
  try {
    await prepareCommittedRecoveries(req, { deadline, now })
  } catch {
    preparationFailed = true
  }
  const result = await runBoundedTransactionalEmailWorker(
    {
      sweep: worker.sweepForBatch,
      candidates: worker.candidatesForBatch,
      claim: (id, mayClaim) => worker.claimForBatch(String(id), mayClaim),
      processClaim: worker.processClaimForBatch,
    },
    now,
    deadline,
  )
  if (preparationFailed) throw new Error('Auth email command preparation unavailable.')
  return result
}
