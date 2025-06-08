/**
 * Example of how to migrate from insecure jwtDecode to secure JWT verification
 * 
 * This file demonstrates the security upgrade needed for issue #200.
 */

// ❌ INSECURE - DO NOT USE IN PRODUCTION
// This is what PR #195 introduced that needs to be replaced:
/*
import { jwtDecode } from 'jwt-decode'

// SECURITY ISSUE: This only decodes the JWT without verifying the signature!
// Anyone can create a fake JWT with any claims and this will accept it.
export const insecureStrategy = async ({ payload, req }) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    throw new Error('No authentication token provided.')
  }

  // ❌ DANGEROUS: Only decoding, not verifying signature
  let decodedToken
  try {
    decodedToken = jwtDecode(token) // No signature verification!
  } catch (decodeError) {
    throw new Error('Invalid token.')
  }

  // The rest of the logic trusts the unverified token content...
  const supabaseUserId = decodedToken.sub
  // ... 
}
*/

// ✅ SECURE - USE THIS INSTEAD
// This is the solution implemented for issue #200:
import { secureSupabaseStrategy } from './secureSupabaseStrategy'

/**
 * Create a secure Supabase authentication strategy for PayloadCMS
 * 
 * This strategy:
 * 1. Verifies JWT signatures using Supabase's JWKS
 * 2. Validates token claims and structure
 * 3. Provides secure error handling
 * 4. Caches JWKS for performance
 * 
 * Usage in collection config:
 */
export function createSecureSupabaseStrategy() {
  return {
    name: 'supabase-secure',
    strategy: secureSupabaseStrategy,
  }
}

/**
 * Example usage in a collection (e.g., BasicUsers.ts):
 * 
 * export const BasicUsers: CollectionConfig = {
 *   slug: 'basicUsers',
 *   auth: {
 *     disableLocalStrategy: true,
 *     strategies: [createSecureSupabaseStrategy()],
 *   },
 *   // ... rest of config
 * }
 */

/**
 * Required environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL: Your Supabase project URL
 * 
 * The JWT verification will automatically use:
 * - {SUPABASE_URL}/auth/v1/.well-known/jwks.json
 * 
 * Security benefits:
 * 1. Prevents token forgery attacks
 * 2. Validates token signatures using public key cryptography
 * 3. Ensures tokens are issued by your Supabase instance
 * 4. Protects against man-in-the-middle attacks
 * 5. Validates token expiration and claims
 */