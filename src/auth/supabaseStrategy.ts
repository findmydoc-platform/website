import { createClient } from '@/utilities/supabase/server'
import { jwtDecode } from 'jwt-decode'

export interface SupabaseStrategyConfig {
  collection: string
  defaultRole: string | string[]
}

export function createSupabaseStrategy(config: SupabaseStrategyConfig) {
  return {
    name: 'supabase',
    authenticate: async ({ payload }: { payload: any }) => {
      try {
        const supabaseClient = await createClient()
        const {
          data: { user: supabaseUser },
        } = await supabaseClient.auth.getUser()

        const { data: sessionData } = await supabaseClient.auth.getSession()
        // Decode the access token to get user_role

        let accessToken: string | undefined
        let userRole: string | undefined
        if (sessionData.session && sessionData.session.access_token) {
          accessToken = sessionData.session.access_token
        }
        try {
          if (accessToken) {
            const decodedToken = jwtDecode(accessToken) as any
            userRole = decodedToken.user_role
          }
        } catch (decodeError) {
          console.warn('Failed to decode access token:', decodeError)
        }

        // Ensure supabaseUser is not null before proceeding
        if (!supabaseUser) {
          throw new Error('Supabase user not found')
        }

        // Try to find an existing user in the specified collection using the Supabase ID
        const userQuery = await payload.find({
          collection: config.collection,
          where: {
            supabaseId: { equals: supabaseUser.id },
          },
        })

        if (userQuery.docs.length > 0) {
          return {
            user: {
              collection: config.collection,
              ...userQuery.docs[0],
            },
          }
        }

        // Create new user if not found
        const newUser = await payload.create({
          collection: config.collection,
          data: {
            email: supabaseUser.email,
            supabaseId: supabaseUser.id,
            firstName: 'firstName',
            lastName: 'lastName',
            name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
            role: 'user',
            userCollection: userRole, // Save the user_role from the custom claim
          },
        })

        return {
          user: {
            collection: config.collection,
            ...newUser,
          },
        }
      } catch (err) {
        console.error('Supabase auth strategy error:', err)
        return { user: null }
      }
    },
  }
}
