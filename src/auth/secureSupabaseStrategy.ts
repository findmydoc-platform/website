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
 * 
 * Note: This is a secure implementation template. To use with specific collections,
 * ensure the target collections exist and have the required fields.
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

    // For now, return a basic user object demonstrating secure JWT verification
    // This can be extended to work with specific collections when they exist
    return {
      id: supabaseUserId,
      email: userEmail,
      userType: userType,
      collection: 'verified-users', // Placeholder - adjust for actual collections
      // JWT signature has been verified at this point, so we can trust these claims
    }

    // The following is example code for when the collections from PR #195 are available:
    /*
    if (userType === 'clinic' || userType === 'platform') {
      return await handleStaffUser(payload, supabaseUserId, userType, userEmail)
    } else if (userType === 'patient') {
      return await handlePatientUser(payload, req, supabaseUserId, userEmail)
    } else {
      console.error(`Unknown userType encountered in verified JWT: ${userType} for user ${supabaseUserId}`)
      throw new Error('Unauthorized: Invalid user type')
    }
    */

  } catch (err: any) {
    console.error('Secure Supabase auth strategy error:', {
      message: err.message,
      // Don't log sensitive information
      requestPath: req.path,
      userAgent: req.get && req.get('User-Agent'),
    })
    
    // Return null user to indicate authentication failure
    return null
  }
}

/**
 * Example implementation for staff users (when basicUsers collection exists)
 * This demonstrates the secure pattern for user creation and retrieval
 */
export async function handleStaffUserExample(
  payload: Payload,
  supabaseUserId: string,
  userType: 'clinic' | 'platform',
  userEmail?: string
) {
  // This would work when the collections from PR #195 are merged
  console.log('Example: Would handle staff user with verified JWT:', {
    supabaseUserId,
    userType,
    email: userEmail,
  })
  
  // Example secure user handling logic:
  // 1. Look up user by verified supabaseUserId
  // 2. Create user if doesn't exist (with verified email)
  // 3. Return user data for authentication
  
  return {
    id: supabaseUserId,
    email: userEmail,
    userType: userType,
    verified: true, // JWT signature was verified
  }
}

/**
 * Example implementation for patient users (when patients collection exists)
 */
export async function handlePatientUserExample(
  payload: Payload,
  req: any,
  supabaseUserId: string,
  userEmail?: string
) {
  // Block Admin UI access for patients
  if (req.path?.startsWith('/admin') || req.path?.startsWith('/api/admin')) {
    console.warn(`Patient user ${supabaseUserId} attempted to access Admin UI path: ${req.path}`)
    throw new Error('Access Denied: Patients cannot access the Admin UI')
  }

  console.log('Example: Would handle patient user with verified JWT:', {
    supabaseUserId,
    email: userEmail,
  })
  
  return {
    id: supabaseUserId,
    email: userEmail,
    userType: 'patient',
    verified: true, // JWT signature was verified
  }
}

/**
 * Extract first name from email address as a fallback
 */
function extractFirstName(email: string): string | null {
  try {
    const localPart = email.split('@')[0]
    if (!localPart) return null
    
    // Remove common separators and capitalize
    const name = localPart.replace(/[._-]/g, ' ').toLowerCase()
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return null
  }
}