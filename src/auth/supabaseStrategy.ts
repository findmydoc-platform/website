import { createClient } from '@/utilities/supabase/server'

export const supabaseStrategy = {
  name: 'supabase',
  authenticate: async ({ payload, headers }) => {
    try {
      const supabaseClient = await createClient()

      const {
        data: { user: supabaseUser },
        error,
      } = await supabaseClient.auth.getUser()

      if (error || !supabaseUser) {
        return { user: null }
      }

      // Try to find an existing user with the Supabase ID
      const userQuery = await payload.find({
        collection: 'staff',
        where: {
          supabaseId: {
            equals: supabaseUser.id,
          },
        },
      })

      if (userQuery.docs.length > 0) {
        return {
          user: {
            collection: 'staff',
            ...userQuery.docs[0],
          },
        }
      }

      // Create new user if not found
      const newUser = await payload.create({
        collection: 'staff',
        data: {
          email: supabaseUser.email,
          supabaseId: supabaseUser.id,
          name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
          role: 'user',
        },
      })

      return {
        user: {
          collection: 'staff',
          ...newUser,
        },
      }
    } catch (err) {
      console.error('Supabase auth strategy error:', err)
      return { user: null }
    }
  },
}
