import { jwtVerify, createRemoteJWKSet, JWTPayload } from 'jose'

// Define the expected structure of the Supabase JWT payload
export interface SupabaseJWTPayload extends JWTPayload {
  sub: string // Supabase User ID
  email?: string
  app_metadata?: {
    user_type?: 'patient' | 'clinic' | 'platform'
    // other app_metadata fields...
  }
  // other standard JWT claims...
}

// Cache for JWKS to avoid repeated requests
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null
let jwksUrl: string | null = null

/**
 * Get the JWKS URL for the Supabase project
 */
function getJWKSUrl(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is required')
  }
  return `${supabaseUrl}/auth/v1/.well-known/jwks.json`
}

/**
 * Get the JWKS client, creating it if necessary
 */
function getJWKS() {
  const currentJwksUrl = getJWKSUrl()
  
  // Create new JWKS client if URL changed or doesn't exist
  if (!jwksCache || jwksUrl !== currentJwksUrl) {
    jwksUrl = currentJwksUrl
    jwksCache = createRemoteJWKSet(new URL(jwksUrl))
  }
  
  return jwksCache
}

/**
 * Verify a JWT token using Supabase's JWKS
 * This replaces insecure jwtDecode usage with proper signature verification
 * 
 * @param token - The JWT token to verify
 * @returns The verified JWT payload
 * @throws Error if token is invalid or verification fails
 */
export async function verifySupabaseJWT(token: string): Promise<SupabaseJWTPayload> {
  try {
    const jwks = getJWKS()
    
    // Verify the JWT signature and decode the payload
    const { payload } = await jwtVerify(token, jwks, {
      // Supabase uses RS256 algorithm
      algorithms: ['RS256'],
      // Add additional verification options
      clockTolerance: 60, // Allow 60 seconds clock skew
    })

    // Validate required claims
    if (!payload.sub) {
      throw new Error('JWT missing required "sub" claim')
    }

    // Type assertion after validation
    const supabasePayload = payload as SupabaseJWTPayload

    return supabasePayload
  } catch (error) {
    // Log security-relevant errors
    console.error('JWT verification failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      // Don't log the actual token for security
      tokenPresent: !!token,
      tokenLength: token?.length,
    })
    
    // Re-throw with a generic message to avoid information leakage
    throw new Error('Invalid or expired authentication token')
  }
}

/**
 * Extract and verify JWT from Authorization header
 * 
 * @param authHeader - The Authorization header value
 * @returns The verified JWT payload
 * @throws Error if token is missing, malformed, or verification fails
 */
export async function verifyAuthorizationHeader(authHeader: string | null | undefined): Promise<SupabaseJWTPayload> {
  if (!authHeader) {
    throw new Error('No authentication token provided')
  }

  // Extract token from "Bearer <token>" or "JWT <token>" format
  const tokenMatch = authHeader.match(/^(?:Bearer|JWT)\s+(.+)$/i)
  if (!tokenMatch) {
    throw new Error('Invalid authorization header format')
  }

  const token = tokenMatch[1]
  if (!token) {
    throw new Error('Token is empty')
  }
  
  return await verifySupabaseJWT(token)
}