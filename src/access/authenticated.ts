import type { AccessArgs } from 'payload'

import type { PlatformStaff } from '@/payload-types'

type isAuthenticated = (args: AccessArgs<PlatformStaff>) => boolean

export const authenticated: isAuthenticated = ({ req: { user } }) => {
  return Boolean(user)
}
