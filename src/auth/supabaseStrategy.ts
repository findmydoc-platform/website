import { jwtDecode } from 'jwt-decode'
import type { Payload } from 'payload'
import type { Request } from 'express'

// Define the expected structure of the decoded Supabase JWT payload
interface SupabaseJWTPayload {
  sub: string // Supabase User ID
  email?: string
  app_metadata?: {
    user_type?: 'patient' | 'clinic' | 'platform'
    // other app_metadata fields...
  }
  // other standard JWT claims...
}

// Standalone authentication strategy function
export const supabaseStrategy = async ({ payload, req }: { payload: Payload; req: Request }) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) {
      throw new Error('No authentication token provided.')
    }

    // TODO: Implement robust JWT verification using Supabase public key/JWKS
    // For now, just decoding - THIS IS NOT SECURE FOR PRODUCTION
    // Replace jwtDecode with a proper verification library (e.g., jose, jsonwebtoken)
    // and fetch Supabase JWKS URI (e.g., https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json)
    let decodedToken: SupabaseJWTPayload
    try {
      decodedToken = jwtDecode<SupabaseJWTPayload>(token)
    } catch (decodeError) {
      console.error('Invalid JWT format or decoding error:', decodeError)
      throw new Error('Invalid token.')
    }

    const supabaseUserId = decodedToken.sub
    const userType = decodedToken.app_metadata?.user_type
    const userEmail = decodedToken.email

    if (!supabaseUserId || !userType) {
      console.error('Token missing sub (Supabase User ID) or app_metadata.user_type claim.')
      throw new Error('Invalid token claims.')
    }

    // --- Routing based on userType ---

    if (userType === 'clinic' || userType === 'platform') {
      // --- Staff Flow (Clinic or Platform) ---
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
          // Fetch email from Supabase if not in token (should usually be there)
          // This requires an admin client usually
          console.warn(`Email not found in JWT for new staff user ${supabaseUserId}, creation might fail or have missing email.`)
          // Potentially fetch user details using admin client here if needed
        }

        try {
          basicUserDoc = await payload.create({
            collection: targetCollection,
            data: {
              email: userEmail || 'email-missing@example.com', // Fallback needed
              supabaseUserId: supabaseUserId,
              userType: userType,
            },
          })
          console.log(`Created new basicUser: ${basicUserDoc.id}`)

          // --- Create corresponding profile record --- 
          const profileCollection = userType === 'clinic' ? 'clinicStaff' : 'plattformStaff'
          try {
            await payload.create({
              collection: profileCollection,
              data: {
                user: basicUserDoc.id, // Link to the basicUser
                // Populate required profile fields - get from JWT/Supabase if possible, otherwise use placeholders
                email: userEmail || 'email-missing@example.com', 
                firstName: 'New', // Placeholder
                lastName: userType === 'clinic' ? 'Clinic User' : 'Platform User', // Placeholder
                // Add other required fields with defaults if necessary
              },
            })
            console.log(`Created corresponding profile in ${profileCollection} for basicUser: ${basicUserDoc.id}`)
          } catch (profileErr) {
            console.error(`Failed to create profile in ${profileCollection} for basicUser ${basicUserDoc.id}:`, profileErr)
            // Decide on error handling: delete basicUser? Log and continue?
          }

        } catch (createErr) {
          console.error(`Failed to create basicUser for ${supabaseUserId}:`, createErr)
          throw new Error('Failed to provision staff user in Payload.')
        }
      }

      // Return the basicUser document for authentication
      return {
        ...basicUserDoc,
        collection: targetCollection, // Add collection slug for Payload
      }

    } else if (userType === 'patient') {
      // --- Patient Flow ---
      const targetCollection = 'patients'
      let patientDoc

      // Block Admin UI access for patients
      if (req.path?.startsWith('/admin') || req.path?.startsWith('/api/admin')) {
        console.warn(`Patient user ${supabaseUserId} attempted to access Admin UI path: ${req.path}`)
        throw new Error('Access Denied: Patients cannot access the Admin UI.')
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
          console.warn(`Email not found in JWT for new patient user ${supabaseUserId}, creation might fail or have missing email.`)
        }
        try {
          patientDoc = await payload.create({
            collection: targetCollection,
            data: {
              email: userEmail || 'email-missing@example.com', // Fallback needed
              supabaseUserId: supabaseUserId,
              // Populate required fields - get from JWT/Supabase if possible, otherwise use placeholders
              firstName: 'New', // Placeholder
              lastName: 'Patient', // Placeholder
            },
          })
          console.log(`Created new patient: ${patientDoc.id}`)
        } catch (createErr) {
          console.error(`Failed to create patient user for ${supabaseUserId}:`, createErr)
          throw new Error('Failed to provision patient user in Payload.')
        }
      }

      // Return the patient document for authentication
      return {
        ...patientDoc,
        collection: targetCollection, // Add collection slug for Payload
      }

    } else {
      // Handle unknown userType
      console.error(`Unknown userType encountered in JWT: ${userType} for user ${supabaseUserId}`)
      throw new Error('Unauthorized: Invalid user type.')
    }

  } catch (err: any) {
    console.error('Supabase auth strategy error:', err.message)
    // Return null user to indicate authentication failure
    return null
  }
}

