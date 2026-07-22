import type { Access } from 'payload'

// Clinic: Check if the user is authenticated and is clinic staff
export const isClinicStaff: Access = ({ req: { user } }) => {
  return Boolean(user && user.collection === 'clinicStaff')
}

// Clinic: Check if the user is clinic staff and owns the related profile
export const isOwnClinicStaffProfile: Access = ({ req: { user } }) => {
  if (!user || user.collection !== 'clinicStaff') return false
  return {
    id: {
      equals: user.id,
    },
  }
}
