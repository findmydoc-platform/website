import type { Payload } from 'payload'
import { verifyAuthorizationHeader, SupabaseJWTPayload } from '../utilities/jwt'

/**
 * Secure Supabase authentication strategy with proper JWT verification
 * 
 * This replaces the insecure jwtDecode usage with proper signature verification
 * using Supabase's JWKS (JSON Web Key Set) endpoint.
 * 
 * Security improvements:
 * - Verifies JWT signatures using Supabase's public keys
 * - Validates token claims and structure
 * - Provides secure error handling without information leakage
 * - Caches JWKS for performance while maintaining security
 */
export const secureSupabaseStrategy = async ({ 
  payload, 
  req 
}: { 
  payload: Payload
  req: any // Use any for now to match existing auth strategy pattern
}) => {
  try {
    // Extract and verify JWT from Authorization header
    const verifiedPayload = await verifyAuthorizationHeader(req.headers.authorization)
    
    const supabaseUserId = verifiedPayload.sub
    const userType = verifiedPayload.app_metadata?.user_type
    const userEmail = verifiedPayload.email

    if (!supabaseUserId || !userType) {
      console.error('JWT missing required claims:', {
        hasSubject: !!supabaseUserId,
        hasUserType: !!userType,
        // Don't log sensitive data
      })
      throw new Error('Invalid token claims')
    }

    // --- Routing based on verified userType ---

    if (userType === 'clinic' || userType === 'platform') {
      return await handleStaffUser(payload, supabaseUserId, userType, userEmail)
    } else if (userType === 'patient') {
      return await handlePatientUser(payload, req, supabaseUserId, userEmail)
    } else {
      console.error(`Unknown userType encountered in verified JWT: ${userType} for user ${supabaseUserId}`)
      throw new Error('Unauthorized: Invalid user type')
    }

  } catch (err: any) {
    console.error('Secure Supabase auth strategy error:', {
      message: err.message,
      // Don't log sensitive information
      requestPath: req.path,
      userAgent: req.get('User-Agent'),
    })
    
    // Return null user to indicate authentication failure
    return null
  }
}

/**
 * Handle authentication for staff users (clinic or platform)
 */
async function handleStaffUser(
  payload: Payload,
  supabaseUserId: string,
  userType: 'clinic' | 'platform',
  userEmail?: string
) {
  const targetCollection = 'basicUsers'
  let basicUserDoc

  // Find existing basicUser
  const userQuery = await payload.find({
    collection: targetCollection,
    where: {
      supabaseUserId: { equals: supabaseUserId },
    },
    limit: 1,
  })

  if (userQuery.docs.length > 0) {
    basicUserDoc = userQuery.docs[0]
  } else {
    // Create new basicUser if not found
    if (!userEmail) {
      console.warn(`Email not found in verified JWT for new staff user ${supabaseUserId}`)
      throw new Error('Email required for user creation')
    }

    try {
      basicUserDoc = await payload.create({
        collection: targetCollection,
        data: {
          email: userEmail,
          supabaseUserId: supabaseUserId,
          userType: userType,
        },
      })
      console.log(`Created new basicUser: ${basicUserDoc.id}`)

      // Create corresponding profile record
      const profileCollection = userType === 'clinic' ? 'clinicStaff' : 'plattformStaff'
      try {
        await payload.create({
          collection: profileCollection,
          data: {
            user: basicUserDoc.id, // Link to the basicUser
            email: userEmail,
            firstName: extractFirstName(userEmail) || 'New',
            lastName: userType === 'clinic' ? 'Clinic User' : 'Platform User',
          },
        })
        console.log(`Created corresponding profile in ${profileCollection} for basicUser: ${basicUserDoc.id}`)
      } catch (profileErr) {
        console.error(`Failed to create profile in ${profileCollection} for basicUser ${basicUserDoc.id}:`, profileErr)
        // Consider whether to delete basicUser or continue
      }

    } catch (createErr) {
      console.error(`Failed to create basicUser for ${supabaseUserId}:`, createErr)
      throw new Error('Failed to provision staff user')
    }
  }

  // Return the basicUser document for authentication
  return {
    ...basicUserDoc,
    collection: targetCollection,
  }
}

/**
 * Handle authentication for patient users
 */
async function handlePatientUser(
  payload: Payload,
  req: any,
  supabaseUserId: string,
  userEmail?: string
) {
  const targetCollection = 'patients'
  let patientDoc

  // Block Admin UI access for patients
  if (req.path?.startsWith('/admin') || req.path?.startsWith('/api/admin')) {
    console.warn(`Patient user ${supabaseUserId} attempted to access Admin UI path: ${req.path}`)
    throw new Error('Access Denied: Patients cannot access the Admin UI')
  }

  // Find existing patient
  const patientQuery = await payload.find({
    collection: targetCollection,
    where: {
      supabaseUserId: { equals: supabaseUserId },
    },
    limit: 1,
  })

  if (patientQuery.docs.length > 0) {
    patientDoc = patientQuery.docs[0]
  } else {
    // Create new patient if not found
    if (!userEmail) {
      console.warn(`Email not found in verified JWT for new patient user ${supabaseUserId}`)
      throw new Error('Email required for user creation')
    }
    
    try {
      patientDoc = await payload.create({
        collection: targetCollection,
        data: {
          email: userEmail,
          supabaseUserId: supabaseUserId,
          firstName: extractFirstName(userEmail) || 'New',
          lastName: 'Patient',
        },
      })
      console.log(`Created new patient: ${patientDoc.id}`)
    } catch (createErr) {
      console.error(`Failed to create patient user for ${supabaseUserId}:`, createErr)
      throw new Error('Failed to provision patient user')
    }
  }

  // Return the patient document for authentication
  return {
    ...patientDoc,
    collection: targetCollection,
  }
}

/**
 * Extract first name from email address as a fallback
 */
function extractFirstName(email: string): string | null {
  try {
    const localPart = email.split('@')[0]
    // Remove common separators and capitalize
    const name = localPart.replace(/[._-]/g, ' ').toLowerCase()
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return null
  }
}