import type { Access } from 'payload'

// Platform staff is a direct Payload principal. Legacy BasicUsers never authorize requests.
export const isPlatformStaff: Access = ({ req: { user } }) => {
  return Boolean(user && user.collection === 'platformStaff')
}

// Platform: Check if the user is platform staff (admin access)
export const isPlatformStaffOrSelf: Access = ({ req: { user }, id: _id }) => {
  if (user && user.collection === 'platformStaff') {
    return true
  }
  return false
}
