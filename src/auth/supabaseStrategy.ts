import { createClient } from '@/utilities/supabase/server'

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
          error,
        } = await supabaseClient.auth.getUser()

        if (error || !supabaseUser) {
          return { user: null }
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
            roles: [config.defaultRole],
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
