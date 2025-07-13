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
    console.debug('No Supabase user session found')
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
    console.warn('Failed to decode access token:', decodeError)
  }

  const supabaseUserId = supabaseUser.id
  const userEmail = supabaseUser.email

  if (!supabaseUserId || !userType) {
    console.error('Token missing sub (Supabase User ID) or app_metadata.user_type claim.', {
      supabaseUserId: !!supabaseUserId,
      userType,
      userEmail,
    })
    throw new Error('Invalid token claims.')
  }

  if (!userEmail || userEmail.trim() === '') {
    console.error('Missing or empty email from Supabase user', {
      supabaseUserId,
      userType,
      hasEmail: !!userEmail,
    })
    throw new Error('Invalid user email.')
  }

  if (!USER_CONFIG[userType as keyof typeof USER_CONFIG]) {
    console.error(`Unknown userType encountered: ${userType} for user ${supabaseUserId}`, {
      supabaseUserId,
      userType,
      userEmail,
      availableTypes: Object.keys(USER_CONFIG),
    })
    throw new Error('Unauthorized: Invalid user type.')
  }

  return {
    supabaseUserId,
    userEmail: userEmail.trim(),
    userType: userType as 'clinic' | 'platform' | 'patient',
    firstName: supabaseUser.user_metadata?.first_name?.trim() || '',
    lastName: supabaseUser.user_metadata?.last_name?.trim() || '',
  }
}

/**
 * Creates a new user in the appropriate collection.
 * Profile creation is handled by the BasicUsers collection hook.
 * @param payload - The PayloadCMS instance.
 * @param authData - The extracted authentication data from Supabase.
 * @param config - The user configuration (collection and profile settings).
 * @returns The created user document.
 */
async function createNewUser(
  payload: any,
  authData: AuthData,
  config: any,
  req: any,
): Promise<any> {
  console.info(`Creating new ${authData.userType} user`, {
    supabaseUserId: authData.supabaseUserId,
    collection: config.collection,
  })

  // Prepare user data based on collection type
  const userData: any = {
    supabaseUserId: authData.supabaseUserId,
    email: authData.userEmail,
  }

  // Add userType for BasicUsers collection (clinic/platform staff)
  if (config.collection === 'basicUsers') {
    userData.userType = authData.userType
  } else if (config.collection === 'patients') {
    // Patients collection has firstName/lastName fields
    userData.firstName = authData.firstName || 'Unknown'
    userData.lastName = authData.lastName || 'User'
  }

  try {
    // Create user - profile will be created automatically by hook for BasicUsers
    const userDoc = await payload.create({
      collection: config.collection,
      data: userData,
      req,
      overrideAccess: true,
    })

    console.info(`Created new ${authData.userType} user: ${userDoc.id}`, {
      collection: config.collection,
      supabaseUserId: authData.supabaseUserId,
      userType: authData.userType,
      userId: userDoc.id,
    })

    return userDoc
  } catch (error: any) {
    console.error(`Failed to create ${authData.userType} user`, {
      supabaseUserId: authData.supabaseUserId,
      collection: config.collection,
      error: error.message,
      stack: error.stack,
      validationErrors: error.data?.errors || null,
      errorName: error.name,
    })

    // Re-throw with more context
    if (error.name === 'ValidationError') {
      throw new Error(`Validation failed for ${authData.userType} user: ${error.message}`)
    } else {
      throw new Error(`Failed to create ${authData.userType} user: ${error.message}`)
    }
  }
}

/**
 * Create or find a user in the appropriate collection based on authentication data.
 * @param payload - The PayloadCMS instance.
 * @param authData - The extracted authentication data from Supabase.
 * @param req - The request object.
 * @returns The created or found user document.
 */
async function createOrFindUser(payload: any, authData: AuthData, req: any): Promise<UserResult> {
  const config = USER_CONFIG[authData.userType]
  const { collection } = config

  console.info(`Creating or finding user in collection: ${collection}`, {
    supabaseUserId: authData.supabaseUserId,
    userType: authData.userType,
    hasEmail: !!authData.userEmail,
    hasFirstName: !!authData.firstName,
    hasLastName: !!authData.lastName,
  })

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
    console.info(`Found existing user: ${userDoc.id}`, {
      collection,
      supabaseUserId: authData.supabaseUserId,
    })
  } else {
    // Create user - profile will be created automatically by hook for BasicUsers
    try {
      userDoc = await createNewUser(payload, authData, config, req)
      console.info(`Successfully created user: ${userDoc.id}`, {
        collection,
        supabaseUserId: authData.supabaseUserId,
        userType: authData.userType,
      })
    } catch (createErr: any) {
      console.error(`User creation failed for ${authData.userType} user`, {
        supabaseUserId: authData.supabaseUserId,
        userType: authData.userType,
        collection,
        email: authData.userEmail,
        error: createErr.message,
        stack: createErr.stack,
      })

      // Re-throw the error from user creation
      throw createErr
    }
  }

  return {
    user: userDoc,
    collection,
  }
}

const authenticate = async (args: any) => {
  const { payload, req } = args
  try {
    console.info('Starting Supabase authentication process')

    // Extract user data from Supabase session
    const authData = await extractSupabaseUserData()

    if (!authData) {
      console.warn('No auth data found - user not logged in')
      return { user: null }
    }

    console.info('Successfully extracted auth data from Supabase', {
      supabaseUserId: authData.supabaseUserId,
      userType: authData.userType,
      hasEmail: !!authData.userEmail,
    })

    // Create or find user in appropriate collection
    const result = await createOrFindUser(payload, authData, req)

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
          console.warn(
            `Clinic user ${result.user.id} attempted login but is not approved for admin access`,
            {
              userId: result.user.id,
              supabaseUserId: authData.supabaseUserId,
              userType: authData.userType,
            },
          )
          return { user: null }
        }

        console.info(`Clinic user ${result.user.id} is approved for admin access`)
      } catch (error: any) {
        console.error('Error checking clinic staff approval status', {
          userId: result.user.id,
          error: error.message,
          stack: error.stack,
        })
        return { user: null }
      }
    }

    console.info('Authentication successful', {
      userId: result.user.id,
      collection: result.collection,
      userType: authData.userType,
    })

    return {
      user: {
        collection: result.collection,
        ...result.user,
      },
    }
  } catch (err: any) {
    console.error('Supabase auth strategy error', {
      error: err.message,
      stack: err.stack,
      name: err.name,
    })
    return { user: null }
  }
}

export const supabaseStrategy = {
  name: 'supabase',
  authenticate,
}
