import { jwtDecode } from 'jwt-decode'
import { createClient } from '@/utilities/supabase/server'

/**
 * Unified Supabase authentication strategy for both BasicUsers and Patients
 * - BasicUsers (clinic/platform staff): Can access admin UI and APIs
 * - Patients: Can only access APIs for their own data
 * - Admin UI access is controlled by payload.config.ts admin.user setting
 * - API access is controlled by collection-level access rules
 */

interface SupabaseJWTPayload {
  sub: string // Supabase User ID
  email?: string
  app_metadata?: {
    user_type?: 'patient' | 'clinic' | 'platform'
  }
}

interface AuthData {
  supabaseUserId: string
  userEmail: string
  userType: 'clinic' | 'platform' | 'patient'
  firstName?: string
  lastName?: string
}

interface UserResult {
  user: any
  collection: string
}

const USER_CONFIG = {
  clinic: {
    collection: 'basicUsers',
    profile: 'clinicStaff',
    label: 'Clinic User',
  },
  platform: {
    collection: 'basicUsers',
    profile: 'plattformStaff',
    label: 'Platform User',
  },
  patient: {
    collection: 'patients',
    profile: null,
    label: 'Patient',
  },
} as const

async function extractSupabaseUserData(): Promise<AuthData> {
  const supabaseClient = await createClient()
  const {
    data: { user: supabaseUser },
  } = await supabaseClient.auth.getUser()

  const { data: sessionData } = await supabaseClient.auth.getSession()

  // Ensure supabaseUser is not null before proceeding
  if (!supabaseUser) {
    throw new Error('Supabase user not found')
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
      userType = decodedToken.app_metadata?.user_type || 'platform'
    }
  } catch (decodeError) {
    console.warn('Failed to decode access token:', decodeError)
  }

  const supabaseUserId = supabaseUser.id
  const userEmail = supabaseUser.email

  if (!supabaseUserId || !userType) {
    console.error('Token missing sub (Supabase User ID) or app_metadata.user_type claim.')
    throw new Error('Invalid token claims.')
  }

  if (!USER_CONFIG[userType as keyof typeof USER_CONFIG]) {
    console.error(`Unknown userType encountered: ${userType} for user ${supabaseUserId}`)
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
    console.log(
      `Found existing ${authData.userType} user: ${userQuery.docs[0].id} for Supabase User ID ${authData.supabaseUserId}`,
    )
    userDoc = userQuery.docs[0]
  } else {
    // Create new user if not found
    if (!authData.userEmail) {
      console.warn(`Email not found for new ${authData.userType} user ${authData.supabaseUserId}`)
    }

    try {
      const userData: any = {
        email: authData.userEmail,
        supabaseUserId: authData.supabaseUserId,
        firstName: authData.firstName,
        lastName: authData.lastName,
      }

      // Add userType for BasicUsers collection
      if (collection === 'basicUsers') {
        userData.userType = authData.userType
      }

      userDoc = await payload.create({
        collection,
        data: userData,
      })
      console.log(`Created new ${authData.userType} user: ${userDoc.id}`)

      // Create corresponding profile record for staff
      if (config.profile) {
        try {
          await payload.create({
            collection: config.profile,
            data: {
              user: userDoc.id,
              email: authData.userEmail,
              firstName: authData.firstName,
              lastName: authData.lastName,
            },
          })
          console.log(`Created profile in ${config.profile} for user: ${userDoc.id}`)
        } catch (profileErr) {
          console.error(
            `Failed to create profile in ${config.profile} for user ${userDoc.id}:`,
            profileErr,
          )
        }
      }
    } catch (createErr) {
      console.error(
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

    // Create or find user in appropriate collection
    const result = await createOrFindUser(payload, authData)

    console.log(
      `Authenticated ${authData.userType} user: ${result.user.id} in collection ${result.collection}`,
      {
        userId: result.user.id,
        collection: result.collection,
        userEmail: result.user.email,
      },
    )

    payload.logger.debug(`User data:`, JSON.stringify(result.user, null, 2))
    // Return the correct format for PayloadCMS
    // According to docs: return { user: { collection: 'collectionSlug', ...userDoc } }
    return {
      user: {
        collection: result.collection,
        ...result.user,
      },
    }
  } catch (err: any) {
    console.error('Supabase auth strategy error:', err.message)
    return { user: null }
  }
}

export const supabaseStrategy = {
  name: 'supabase',
  authenticate,
}
