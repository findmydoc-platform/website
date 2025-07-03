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

// Platform: Check if user is platform admin using async query
export const isPlatformAdmin: Access = async ({ req: { user, payload } }) => {
  if (!user || user.collection !== 'basicUsers' || user.userType !== 'platform') return false

  try {
    // Query platform staff to check user's role
    const platformStaff = await payload.find({
      collection: 'plattformStaff',
      where: {
        and: [
          {
            user: {
              equals: user.id,
            },
          },
          {
            role: {
              equals: 'admin',
            },
          },
        ],
      },
      limit: 1,
    })

    return platformStaff.docs.length > 0
  } catch (error) {
    payload.logger.error('Error checking platform admin status:', error)
    return false
  }
}

// Platform: Admin can access any platform staff data (for read/update operations)
export const isPlatformAdminOrSelf: Access = async ({ req: { user, payload } }) => {
  if (!user || user.collection !== 'basicUsers' || user.userType !== 'platform') return false

  try {
    // Query platform staff to check user's role
    const platformStaff = await payload.find({
      collection: 'plattformStaff',
      where: {
        user: {
          equals: user.id,
        },
      },
      limit: 1,
    })

    // Check if user is admin
    const isAdmin = platformStaff.docs[0]?.role === 'admin'

    if (isAdmin) {
      // Admin can access all platform staff records
      return true
    } else {
      // Regular staff can only access their own profile
      return {
        user: {
          equals: user.id,
        },
      }
    }
  } catch (error) {
    payload.logger.error('Error checking platform admin status:', error)
    return false
  }
}

// Platform: Only admins can create/delete platform staff
export const isPlatformAdminOnly: Access = async ({ req: { user, payload } }) => {
  if (!user || user.collection !== 'basicUsers' || user.userType !== 'platform') return false

  try {
    // Query platform staff to check user's role
    const platformStaff = await payload.find({
      collection: 'plattformStaff',
      where: {
        user: {
          equals: user.id,
        },
      },
      limit: 1,
    })

    // Only allow if user is admin
    return platformStaff.docs[0]?.role === 'admin'
  } catch (error) {
    payload.logger.error('Error checking platform admin status:', error)
    return false
  }
}
