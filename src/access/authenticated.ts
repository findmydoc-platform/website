import type { AccessArgs } from 'payload'

import type { Staff } from '@/payload-types'

type isAuthenticated = (args: AccessArgs<Staff>) => boolean

export const authenticated: isAuthenticated = ({ req: { user } }) => {
  return Boolean(user)
}
