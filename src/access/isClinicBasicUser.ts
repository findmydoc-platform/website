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

// Clinic: Check if the user is approved clinic staff for admin UI access
export const isApprovedClinicStaff: Access = async ({ req: { user, payload } }) => {
  if (!user || user.collection !== 'basicUsers' || user.userType !== 'clinic') return false

  try {
    const clinicStaffResult = await payload.find({
      collection: 'clinicStaff',
      where: {
        user: { equals: user.id },
        status: { equals: 'approved' },
      },
      limit: 1,
    })

    return clinicStaffResult.docs.length > 0
  } catch (error) {
    payload.logger.error('Error checking clinic staff approval status:', error)
    return false
  }
}
