import type { Access } from 'payload'

// Platform: Check if the user is authenticated and is platform staff
export const isPlatformBasicUser: Access = ({ req: { user } }) => {
  return Boolean(user && user.collection === 'basicUsers' && user.userType === 'platform')
}

// Platform: Check if the user is platform staff (admin access)
export const isPlatformStaffOrSelf: Access = ({ req: { user }, id: _id }) => {
  if (user && user.collection === 'basicUsers' && user.userType === 'platform') {
    return true
  }
  return {
    user: {
      equals: user?.id,
    },
  }
}
