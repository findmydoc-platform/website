import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

// Common configuration for createServerClient
const getSupabaseConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined')
  }
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined')
  }

  return { url, key }
}

export async function getUser(response: NextResponse, request: NextRequest) {
  const { url, key } = getSupabaseConfig()
  const supabaseClient = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const user = (await supabaseClient.auth.getUser()).data.user
  return user
}

export async function createClient() {
  const { url, key } = getSupabaseConfig()
  const cookieStore = await cookies()
  // console.debug('createClient cookies:', cookieStore.getAll().map(c => c.name))
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {}
      },
    },
  })
}

// Create a Supabase admin client for server-side admin operations
export async function createAdminClient() {
  const { url } = getSupabaseConfig()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createServerClient(url, serviceRoleKey, {
    cookies: {
      getAll() {
        return []
      },
      setAll() {
        // Admin client doesn't need cookie management
      },
    },
  })
}
