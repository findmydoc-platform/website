import type { CollectionAfterChangeHook } from 'payload'
import type { BasicUser } from '../payload-types'

/**
 * Automatically creates profile records for BasicUsers after they are created.
 * - clinic users → clinicStaff profile
 * - platform users → platformStaff profile
 * - patients are handled separately and don't need profiles
 */

/**
 * Configuration for user types and their corresponding profile collections
 */
const PROFILE_CONFIG = {
  clinic: {
    collection: 'clinicStaff',
    defaultData: {
      status: 'pending',
    },
  },
  platform: {
    collection: 'platformStaff',
    defaultData: {
      role: 'admin',
    },
  },
} as const

/**
 * Creates a profile record for the user in the appropriate collection
 */
async function createUserProfile(
  userDoc: BasicUser,
  userType: 'clinic' | 'platform',
  payload: any,
  req: any,
): Promise<void> {
  const config = PROFILE_CONFIG[userType]

  try {
    // Check if profile already exists to avoid duplicates
    const existingProfile = await payload.find({
      collection: config.collection,
      where: {
        user: { equals: userDoc.id },
      },
      limit: 1,
      req,
    })

    if (existingProfile.docs.length > 0) {
      payload.logger.info(`Profile already exists for ${userType} user: ${userDoc.id}`)
      return
    }

    // Prepare profile data
    const profileData: any = {
      user: userDoc.id,
      firstName: 'Unknown', // Will be updated when user completes profile
      lastName: 'User',
      ...config.defaultData,
    }

    // For clinic staff profiles, also store the contact email from the BasicUser
    if (userType === 'clinic') {
      profileData.email = userDoc.email
    }

    // Create the profile
    const profileDoc = await payload.create({
      collection: config.collection,
      data: profileData,
      req, // Pass req object to maintain context
      overrideAccess: true, // Bypass access controls for hook-based creation
    })

    payload.logger.info(`Created ${userType} profile for user: ${userDoc.id}`, {
      profileId: profileDoc.id,
      profileCollection: config.collection,
    })
  } catch (error: any) {
    payload.logger.error(`Failed to create ${userType} profile for user: ${userDoc.id}`, {
      error: error.message,
      userType,
      collection: config.collection,
    })
    // Don't throw - user creation should succeed even if profile creation fails
    // Profile can be created manually or retried later
  }
}

/**
 * Hook that runs after BasicUser creation to automatically create profiles
 */
export const createUserProfileHook: CollectionAfterChangeHook<BasicUser> = async ({ doc, operation, req }) => {
  // Only run on user creation
  if (operation !== 'create') {
    return doc
  }

  // Skip if context indicates this should be skipped (prevents infinite loops)
  if (req.context?.skipProfileCreation) {
    return doc
  }

  const { payload } = req
  const userType = doc.userType

  // Only create profiles for clinic and platform users
  if (userType === 'clinic' || userType === 'platform') {
    payload.logger.info(`Creating profile for ${userType} user: ${doc.id}`)
    await createUserProfile(doc, userType, payload, req)
  }

  return doc
}
