import type { Access } from 'payload'

// Clinic: Check if the user is authenticated and is clinic staff
export const isClinicBasicUser: Access = ({ req: { user } }) => {
  return Boolean(user && user.collection === 'basicUsers' && user.userType === 'clinic')
}

// Clinic: Check if the user is clinic staff and owns the related profile
export const isOwnClinicStaffProfile: Access = ({ req: { user } }) => {
  if (!user || user.collection !== 'basicUsers' || user.userType !== 'clinic') return false
  return {
    user: {
      equals: user.id,
    },
  }
}
