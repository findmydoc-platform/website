import type { PayloadRequest } from 'payload'

import { isPlatformBasicUser } from './isPlatformBasicUser'

export const canRunPayloadJobs = ({ req }: { req: PayloadRequest }): boolean => {
  return isPlatformBasicUser({ req }) === true
}
