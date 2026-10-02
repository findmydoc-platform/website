import configPromise from '@payload-config'
import { createLocalReq, getPayload } from 'payload'
import { bindAuthActions } from './lifecycle'

/** The existing five-minute Website scheduler owns this sweep, independently of mail feature flags. */
export async function runHostedRecoveryRetention(deadline: number) {
  const environment = process.env.VERCEL_ENV
  if (environment !== 'preview' && environment !== 'production') throw new Error('Recovery retention unavailable.')
  const payload = await getPayload({ config: configPromise })
  const req = await createLocalReq({}, payload)
  const actions = bindAuthActions(req, { environment })
  const stop = Math.min(deadline, Date.now() + 30000)
  while (Date.now() < stop) {
    const result = await actions.sweepRecovery()
    if (result.deleted < 100) return
  }
  throw new Error('Recovery retention budget exhausted.')
}
