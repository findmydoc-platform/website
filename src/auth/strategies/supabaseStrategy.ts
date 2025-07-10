import payload from 'payload'
import { jwtDecode } from 'jwt-decode'
import { createClient } from '@/auth/utilities/supaBaseServer'

/**
 * Unified Supabase authentication strategy for both BasicUsers and Patients
 * - BasicUsers (clinic/platform staff): Can access admin UI and APIs
 * - Patients: Can only access APIs for their own data
 * - Admin UI access is controlled by payload.config.ts admin.user setting
 * - API access is controlled by collection-level access rules
 * - User type validation is handled by the login API endpoints
 */

/**
 * SupabaseJWTPayload interface representing the decoded JWT payload from Supabase.
 * Contains the Supabase User ID (sub), optional email, and app_metadata with user_type.
 */
interface SupabaseJWTPayload {
  sub: string // Supabase User ID
  email?: string
  app_metadata?: {
    user_type?: 'patient' | 'clinic' | 'platform'
  }
}

/**
 * AuthData interface representing the user data extracted from Supabase session.
 * Contains Supabase User ID, email, user type, and optional first/last names.
 */
interface AuthData {
  supabaseUserId: string
  userEmail: string
  userType: 'clinic' | 'platform' | 'patient'
  firstName?: string
  lastName?: string
}

/**
 * Result type for user creation or lookup.
 * Contains the user document and the collection it belongs to.
 */
interface UserResult {
  user: any
  collection: string
}

/**
 * Configuration for user types and their corresponding collections and profiles.
 * - clinic: BasicUsers collection, clinicStaff profile
 * - platform: BasicUsers collection, platformStaff profile
 * - patient: patients collection, no profile
 */
const USER_CONFIG = {
  clinic: {
    collection: 'basicUsers',
    profile: 'clinicStaff',
    label: 'Clinic User',
  },
  platform: {
    collection: 'basicUsers',
    profile: 'platformStaff',
    label: 'Platform User',
  },
  patient: {
    collection: 'patients',
    profile: null,
    label: 'Patient',
  },
} as const

/**
 * Extracts user data from Supabase session.
 * @returns AuthData object or null if no user is logged in.
 */
async function extractSupabaseUserData(): Promise<AuthData | null> {
  const supabaseClient = await createClient()
  const {
    data: { user: supabaseUser },
  } = await supabaseClient.auth.getUser()

  const { data: sessionData } = await supabaseClient.auth.getSession()

  // Return null if no user is logged in
  if (!supabaseUser) {
    payload.logger.debug('No Supabase user session found')
    return null
  }

  // Decode the access token to get user_role/user_type
  let accessToken: string | undefined
  let userType: string | undefined
  if (sessionData.session && sessionData.session.access_token) {
    accessToken = sessionData.session.access_token
  }

  try {
    if (accessToken) {
      const decodedToken = jwtDecode(accessToken) as SupabaseJWTPayload
      userType = decodedToken.app_metadata?.user_type
    }
  } catch (decodeError) {
    payload.logger.warn('Failed to decode access token:', decodeError)
  }

  const supabaseUserId = supabaseUser.id
  const userEmail = supabaseUser.email

  if (!supabaseUserId || !userType) {
    payload.logger.error('Token missing sub (Supabase User ID) or app_metadata.user_type claim.')
    throw new Error('Invalid token claims.')
  }

  if (!USER_CONFIG[userType as keyof typeof USER_CONFIG]) {
    payload.logger.error(`Unknown userType encountered: ${userType} for user ${supabaseUserId}`)
    throw new Error('Unauthorized: Invalid user type.')
  }

  return {
    supabaseUserId,
    userEmail: userEmail || '',
    userType: userType as 'clinic' | 'platform' | 'patient',
    firstName: supabaseUser.user_metadata?.first_name || '',
    lastName: supabaseUser.user_metadata?.last_name || '',
  }
}

/**
 * Create or find a user in the appropriate collection based on authentication data.
 * @param payload - The PayloadCMS instance.
 * @param authData - The extracted authentication data from Supabase.
 * @returns The created or found user document.
 */
async function createOrFindUser(payload: any, authData: AuthData): Promise<UserResult> {
  const config = USER_CONFIG[authData.userType]
  const { collection } = config

  // Find existing user
  const userQuery = await payload.find({
    collection,
    where: {
      supabaseUserId: { equals: authData.supabaseUserId },
    },
    limit: 1,
  })

  let userDoc
  if (userQuery.docs.length > 0) {
    userDoc = userQuery.docs[0]
  } else {
    try {
      const userData: any = {
        supabaseUserId: authData.supabaseUserId,
        firstName: authData.firstName,
        lastName: authData.lastName,
        email: authData.userEmail,
      }

      // Add userType for BasicUsers collection
      if (collection === 'basicUsers') {
        userData.userType = authData.userType
      }

      userDoc = await payload.create({
        collection,
        data: userData,
      })
      payload.logger.debug(`Created new ${authData.userType} user: ${userDoc.id}`)

      // Create corresponding profile record for staff
      if (config.profile) {
        try {
          await payload.create({
            collection: config.profile,
            data: {
              user: userDoc.id,
              firstName: authData.firstName,
              lastName: authData.lastName,
            },
          })
          payload.logger.debug(`Created profile in ${config.profile} for user: ${userDoc.id}`)
        } catch (profileErr) {
          payload.logger.error(
            `Failed to create profile in ${config.profile} for user ${userDoc.id}:`,
            profileErr,
          )
        }
      }
    } catch (createErr) {
      payload.logger.error(
        `Failed to create ${authData.userType} user for ${authData.supabaseUserId}:`,
        createErr,
      )
      throw new Error(`Failed to provision ${authData.userType} user in Payload.`)
    }
  }

  return {
    user: userDoc,
    collection,
  }
}

const authenticate = async (args: any) => {
  const { payload } = args
  try {
    // Extract user data from Supabase session
    const authData = await extractSupabaseUserData()

    if (!authData) {
      payload.logger.warn('No auth data found.')
      return { user: null }
    }

    // Create or find user in appropriate collection
    const result = await createOrFindUser(payload, authData)

    // For clinic users, check if they are approved before allowing admin UI access
    if (authData.userType === 'clinic') {
      try {
        const clinicStaffResult = await payload.find({
          collection: 'clinicStaff',
          where: {
            user: { equals: result.user.id },
            status: { equals: 'approved' },
          },
          limit: 1,
        })

        if (clinicStaffResult.docs.length === 0) {
          payload.logger.warn(
            `Clinic user ${result.user.id} attempted login but is not approved for admin access`,
          )
          return { user: null }
        }
      } catch (error) {
        payload.logger.error('Error checking clinic staff approval status:', error)
        return { user: null }
      }
    }

    return {
      user: {
        collection: result.collection,
        ...result.user,
      },
    }
  } catch (err: any) {
    payload.logger.error(`Supabase auth strategy error: ${err.message}`, { stack: err.stack })
    return { user: null }
  }
}

export const supabaseStrategy = {
  name: 'supabase',
  authenticate,
}
