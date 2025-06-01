import type { Access } from 'payload/types'

// Check if the user is authenticated and is any type of staff (clinic or platform)
export const isStaff: Access = ({ req: { user } }) => {
  return Boolean(user && user.collection === 'basicUsers')
}

// Check if the user is authenticated and is specifically clinic staff
export const isClinicStaff: Access = ({ req: { user } }) => {
  return Boolean(user && user.collection === 'basicUsers' && user.userType === 'clinic')
}

// Check if the user is authenticated and is specifically platform staff
export const isPlatformStaff: Access = ({ req: { user } }) => {
  return Boolean(user && user.collection === 'basicUsers' && user.userType === 'platform')
}

// Check if the user is clinic staff and owns the related profile
export const isOwnClinicStaffProfile: Access = ({ req: { user } }) => {
  if (!user || user.collection !== 'basicUsers' || user.userType !== 'clinic') return false
  
  // For list operations, restrict to only seeing own profile
  return {
    user: {
      equals: user.id,
    },
  }
}

// Check if the user is platform staff (admin access)
// Platform staff can manage all resources
// Prefixing 'id' with '_' to indicate it's intentionally unused in this specific logic branch
export const isPlatformStaffOrSelf: Access = ({ req: { user }, id: _id }) => {
  // Platform staff can access everything
  if (user && user.collection === 'basicUsers' && user.userType === 'platform') {
    return true
  }
  
  // Other users can only access their own resources (based on the 'user' field in the document)
  return {
    user: {
      equals: user?.id,
    },
  }
}
