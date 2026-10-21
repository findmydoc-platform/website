import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'
import { resolveServerRuntimeEnvironment } from '@/features/runtimePolicy'
import { runClinicNotificationRetention } from './retention'

export async function runHostedClinicNotificationRetention(environment: 'preview' | 'production', deadline: number) {
  if (
    resolveServerRuntimeEnvironment() !== environment ||
    process.env.DEPLOYMENT_ENVIRONMENT !== environment ||
    process.env.VERCEL_ENV !== environment
  )
    throw new Error('Notification retention environment is unavailable.')
  const payload = await getPayload({ config })
  const req = await createLocalReq({}, payload)
  return runClinicNotificationRetention(req, { deadline })
}
