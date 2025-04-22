import type { AccessArgs } from 'payload'

import type { PlattformStaff } from '@/payload-types'

type isAuthenticatedAndAdmin = (args: AccessArgs<PlattformStaff>) => boolean

export const authenticated: isAuthenticatedAndAdmin = ({ req: { user } }) => {
  return Boolean(user && user.role?.includes('admin'))
}
