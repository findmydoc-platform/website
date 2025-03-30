import type { AccessArgs } from 'payload'

import type { Staff } from '@/payload-types'

type isAuthenticatedAndAdmin = (args: AccessArgs<Staff>) => boolean

export const authenticated: isAuthenticatedAndAdmin = ({ req: { user } }) => {
  return Boolean(user && user.roles?.includes('admin'))
}
