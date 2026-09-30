import type { PayloadRequest } from 'payload'

import { isPlatformStaff } from './isPlatformStaff'

export const canRunPayloadJobs = ({ req }: { req: PayloadRequest }): boolean => {
  if (isPlatformStaff({ req }) === true) return true

  const secret = process.env.CRON_SECRET
  if (!secret?.trim()) return false
  if (Object.keys(req.query).length > 0) return false

  return req.headers.get('authorization') === `Bearer ${secret}`
}
