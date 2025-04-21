import type { AccessArgs } from 'payload'

import type { PlattformStaff } from '@/payload-types'

type isAuthenticated = (args: AccessArgs<PlattformStaff>) => boolean

export const authenticated: isAuthenticated = ({ req: { user } }) => {
  return Boolean(user)
}
