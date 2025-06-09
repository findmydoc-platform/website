import { jwtDecode } from 'jwt-decode'
import type { Payload, PayloadRequest } from 'payload'

interface SupabaseJWTPayload {
  sub: string // Supabase User ID
  email?: string
  app_metadata?: {
    user_type?: 'patient' | 'clinic' | 'platform'
  }
}

const authenticate = async (args: any) => {
  const { payload, headers } = args
  // Find req in args - it might be named differently
  const req = args.req || args.request || { headers, url: '' }
  try {
    const authHeader =
      headers?.get?.('authorization') || headers?.authorization || (headers as any)?.Authorization
    const token = typeof authHeader === 'string' ? authHeader.split(' ')[1] : null

    if (!token) {
      throw new Error('No authentication token provided.')
    }

    // TODO: Implement JWT verification using Supabase JWKS
    // Currently only decoding - NOT SECURE FOR PRODUCTION
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
      // Staff Flow
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
          console.warn(`Email not found in JWT for new staff user ${supabaseUserId}`)
        }

        try {
          basicUserDoc = await payload.create({
            collection: targetCollection,
            data: {
              email: userEmail || 'email-missing@example.com',
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
                user: basicUserDoc.id,
                email: userEmail || 'email-missing@example.com',
                firstName: 'New',
                lastName: userType === 'clinic' ? 'Clinic User' : 'Platform User',
              },
            })
            console.log(
              `Created corresponding profile in ${profileCollection} for basicUser: ${basicUserDoc.id}`,
            )
          } catch (profileErr) {
            console.error(
              `Failed to create profile in ${profileCollection} for basicUser ${basicUserDoc.id}:`,
              profileErr,
            )
          }
        } catch (createErr) {
          console.error(`Failed to create basicUser for ${supabaseUserId}:`, createErr)
          throw new Error('Failed to provision staff user in Payload.')
        }
      }

      // Return the basicUser document for authentication
      return {
        ...basicUserDoc,
        collection: targetCollection,
      }
    } else if (userType === 'patient') {
      // Patient Flow
      const targetCollection = 'patients'
      let patientDoc

      // Block Admin UI access for patients
      const url = req.url || ''
      if (url.startsWith('/admin') || url.startsWith('/api/admin')) {
        console.warn(`Patient user ${supabaseUserId} attempted to access Admin UI path: ${url}`)
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
          console.warn(`Email not found in JWT for new patient user ${supabaseUserId}`)
        }
        try {
          patientDoc = await payload.create({
            collection: targetCollection,
            data: {
              email: userEmail || 'email-missing@example.com',
              supabaseUserId: supabaseUserId,
              firstName: 'New',
              lastName: 'Patient',
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
        collection: targetCollection,
      }
    } else {
      // Handle unknown userType
      console.error(`Unknown userType encountered in JWT: ${userType} for user ${supabaseUserId}`)
      throw new Error('Unauthorized: Invalid user type.')
    }
  } catch (err: any) {
    console.error('Supabase auth strategy error:', err.message)
    return null
  }
}

export const supabaseStrategy = {
  name: 'supabase',
  authenticate,
}
