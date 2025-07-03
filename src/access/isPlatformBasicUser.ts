import type { Access } from 'payload'

// Platform: Check if the user is authenticated and is platform staff
export const isPlatformBasicUser: Access = ({ req: { user } }) => {
  return Boolean(user && user.collection === 'basicUsers' && user.userType === 'platform')
}

// Platform: Check if user can access platform staff data (own profile only, admins handled separately)
export const isPlatformStaffOrSelf: Access = ({ req: { user } }) => {
  if (!user || user.collection !== 'basicUsers' || user.userType !== 'platform') return false

  // Platform staff can only access their own profile
  return {
    user: {
      equals: user.id,
    },
  }
}

// Platform: Check if user is platform admin using query constraint
export const isPlatformAdmin: Access = ({ req: { user } }) => {
  if (!user || user.collection !== 'basicUsers' || user.userType !== 'platform') return false

  // Return query constraint to check admin role and user match
  return {
    user: {
      equals: user.id,
    },
    role: {
      equals: 'admin',
    },
  }
}
