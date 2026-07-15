import type { PayloadRequest } from 'payload'

import { isPlatformStaff } from './isPlatformStaff'

export const canRunPayloadJobs = ({ req }: { req: PayloadRequest }): boolean => {
  return isPlatformStaff({ req }) === true
}
