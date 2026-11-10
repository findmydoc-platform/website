import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'
import { sweepExpiredInquiryPreparations } from '@/features/inquiryCommunication/service'

/** Runs independently of transactional-mail activation and never delivers an inquiry. */
export async function runInquiryPreparationCleanup(deadline: number) {
  const payload = await getPayload({ config })
  const req = await createLocalReq({}, payload)
  return sweepExpiredInquiryPreparations(req, Math.min(deadline, Date.now() + 5000))
}
